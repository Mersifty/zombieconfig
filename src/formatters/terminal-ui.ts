import path from 'node:path';
import pc from 'picocolors';
import type { AuditResult } from '../types.js';

function renderBanner(): string {
  return pc.cyan(`
   ____  _               _    ____             __ _       
  / ___|| |__   ___  ___| |_ / ___|___  _ __  / _(_) __ _ 
 | |  _ | '_ \\ / _ \\/ __| __| |   / _ \\| '_ \\| |_| |/ _\` |
 | |_| || | | | (_) \\__ \\ |_| |__| (_) | | | |  _| | (_| |
  \\____||_| |_|\\___/|___/\\__|\\____\\___/|_| |_|_| |_|\\__, |
                                                     |___/ 
  ${pc.gray('Zero-Config Zombie Env & Config Auditor v1.0.0')}
`);
}

function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return pc.green;
  if (score >= 70) return pc.yellow;
  return pc.red;
}

function renderHealthBar(score: number): string {
  const totalBlocks = 20;
  const filledBlocks = Math.round((score / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const colorFn = getScoreColor(score);

  const bar = colorFn('█'.repeat(filledBlocks)) + pc.gray('░'.repeat(emptyBlocks));
  return `${bar} ${colorFn(`${score}/100`)}`;
}

export function formatTerminalReport(result: AuditResult): string {
  const lines: string[] = [];
  const root = result.rootDirectory;

  lines.push(renderBanner());

  // Health Score & Summary Header
  lines.push(pc.bold('📊 AUDIT SUMMARY'));
  lines.push(`   Health Score : ${renderHealthBar(result.healthScore)}`);
  lines.push(`   Code Files   : ${pc.cyan(result.scannedCodeFilesCount.toString())} scanned`);
  lines.push(`   Env Files    : ${pc.cyan(result.scannedEnvFiles.length.toString())} scanned (${result.scannedEnvFiles.map(f => path.basename(f)).join(', ') || 'None found'})`);
  lines.push(`   Variables    : ${pc.cyan(result.definedVariables.length.toString())} defined | ${pc.cyan(result.codeUsages.length.toString())} references`);
  lines.push(`   Audit Time   : ${pc.gray(`${result.executionTimeMs}ms`)}`);
  lines.push('');

  let hasIssues = false;

  // 1. Secret Leaks (Critical priority)
  if (result.secretLeaks.length > 0) {
    hasIssues = true;
    lines.push(pc.bgRed(pc.black(pc.bold(' 🔓 CRITICAL: SECRET LEAKS DETECTED '))) + '\n');
    for (const leak of result.secretLeaks) {
      const relFile = path.relative(root, leak.file) || leak.file;
      lines.push(`  ${pc.red('●')} ${pc.bold(leak.name)}: ${pc.yellow(leak.leakType)}`);
      lines.push(`    ${pc.gray('Location:')} ${pc.underline(`${relFile}:${leak.line}`)}`);
      lines.push(`    ${pc.gray('Exposed :')} ${pc.red(leak.value)}`);
      lines.push('');
    }
  }

  // 2. Type Traps (High priority)
  if (result.typeTraps.length > 0) {
    hasIssues = true;
    lines.push(pc.bgYellow(pc.black(pc.bold(' ⚠️ TYPE TRAPS & LOGIC HAZARDS '))) + '\n');
    for (const trap of result.typeTraps) {
      const relEnv = path.relative(root, trap.envFile) || trap.envFile;
      const relCode = path.relative(root, trap.codeUsage.file) || trap.codeUsage.file;
      lines.push(`  ${pc.yellow('●')} ${pc.bold(trap.name)} ${pc.gray(`(${trap.hazard})`)}`);
      lines.push(`    ${pc.gray('Env Config :')} ${pc.cyan(trap.envValue)} in ${relEnv}:${trap.envLine}`);
      lines.push(`    ${pc.gray('Code Usage :')} "${pc.magenta(trap.codeUsage.codeSnippet)}" in ${relCode}:${trap.codeUsage.line}`);
      lines.push(`    ${pc.gray('Hazard     :')} ${trap.description}`);
      lines.push(`    ${pc.green('Fix        :')} ${trap.recommendation}`);
      lines.push('');
    }
  }

  // 3. Missing Variables (Medium priority)
  if (result.missing.length > 0) {
    hasIssues = true;
    lines.push(pc.bold(pc.red('🚨 MISSING / UNDOCUMENTED VARIABLES')) + '\n');
    for (const item of result.missing) {
      const missingLabels = item.missingIn
        .map((m) => (m === 'active_env' ? pc.red('[Missing in active .env]') : pc.yellow('[Missing in .env.example]')))
        .join(' ');

      lines.push(`  ${pc.red('●')} ${pc.bold(item.name)} ${missingLabels}`);
      if (item.suggestedDefault) {
        lines.push(`    ${pc.gray('Suggested Default:')} ${pc.green(item.suggestedDefault)}`);
      }
      lines.push(`    ${pc.gray('Referenced In:')}`);
      for (const occ of item.occurrences.slice(0, 3)) {
        const relPath = path.relative(root, occ.file) || occ.file;
        lines.push(`      - ${relPath}:${occ.line} ${pc.gray(`("${occ.codeSnippet}")`)}`);
      }
      if (item.occurrences.length > 3) {
        lines.push(`      - ${pc.gray(`...and ${item.occurrences.length - 3} more occurrences`)}`);
      }
      lines.push('');
    }
  }

  // 4. Zombie Variables (Optimization)
  if (result.zombies.length > 0) {
    hasIssues = true;
    lines.push(pc.bold(pc.magenta('🧟 ZOMBIE / GHOST VARIABLES (Defined in config, never used in code)')) + '\n');
    for (const zombie of result.zombies) {
      const actionBadge =
        zombie.suggestedAction === 'keep'
          ? pc.gray('[Standard Runtime Var - Safe]')
          : pc.magenta('[Dead - Can be pruned]');

      lines.push(`  ${pc.magenta('●')} ${pc.bold(zombie.variable.name)} = "${pc.gray(zombie.variable.value)}" ${actionBadge}`);
      lines.push(`    ${pc.gray('Found in:')} ${zombie.filesDefined.join(', ')} (line ${zombie.variable.line})`);
      lines.push('');
    }
  }

  if (!hasIssues) {
    lines.push(pc.green('✨ Excellent! No zombie variables, missing keys, or type traps found. Your environment configuration is pristine! 🎉\n'));
  } else {
    lines.push(pc.bold('💡 QUICK FIX ACTIONS:'));
    lines.push(`   ${pc.cyan('ghostconfig fix --sync-example')}  ${pc.gray('-> Auto-add missing keys to .env.example')}`);
    lines.push(`   ${pc.cyan('ghostconfig fix --prune')}         ${pc.gray('-> Safely comment out dead zombie variables')}`);
    lines.push(`   ${pc.cyan('ghostconfig generate --schema zod')} ${pc.gray('-> Generate type-safe Zod schema from your variables')}`);
    lines.push('');
  }

  return lines.join('\n');
}
