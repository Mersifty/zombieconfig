import path from 'node:path';
import type { AuditResult } from '../types.js';

function getGradeBadge(grade: string): string {
  const badges: Record<string, string> = {
    'A+': '🟢 A+',
    'A': '🟢 A',
    'B': '🟡 B',
    'C': '🟠 C',
    'D': '🔴 D',
    'F': '⛔ F',
  };
  return badges[grade] || grade;
}

export function formatMarkdownReport(result: AuditResult): string {
  const lines: string[] = [];
  const root = result.rootDirectory;

  lines.push('# 🧟 ZombieConfig Audit Report');
  lines.push('');
  lines.push(`> Generated at ${new Date().toISOString()}`);
  lines.push('');

  // Summary Table
  lines.push('## 📊 Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| **Health Score** | ${getGradeBadge(result.healthGrade)} (${result.healthScore}/100) |`);
  lines.push(`| Code Files Scanned | ${result.scannedCodeFilesCount} |`);
  lines.push(`| Env Files Scanned | ${result.scannedEnvFiles.length} |`);
  lines.push(`| Variables Defined | ${result.definedVariables.length} |`);
  lines.push(`| Code References | ${result.codeUsages.length} |`);
  lines.push(`| Audit Duration | ${result.executionTimeMs}ms |`);
  lines.push('');

  // Issues Overview
  const totalIssues =
    result.secretLeaks.length +
    result.typeTraps.length +
    result.missing.length +
    result.zombies.length +
    result.duplicates.length +
    result.valueIssues.length +
    result.deprecations.length;

  lines.push('## 🔍 Issues Overview');
  lines.push('');
  lines.push('| Category | Count | Severity |');
  lines.push('|----------|-------|----------|');
  lines.push(`| 🔓 Secret Leaks | ${result.secretLeaks.length} | ${result.secretLeaks.length > 0 ? '🔴 Critical' : '✅ None'} |`);
  lines.push(`| ⚠️ Type Traps | ${result.typeTraps.length} | ${result.typeTraps.length > 0 ? '🟠 High' : '✅ None'} |`);
  lines.push(`| 🚨 Missing Variables | ${result.missing.length} | ${result.missing.length > 0 ? '🟡 Medium' : '✅ None'} |`);
  lines.push(`| 🧟 Zombie Variables | ${result.zombies.length} | ${result.zombies.length > 0 ? '🟡 Medium' : '✅ None'} |`);
  lines.push(`| 🔁 Duplicate Variables | ${result.duplicates.length} | ${result.duplicates.length > 0 ? '🟡 Medium' : '✅ None'} |`);
  lines.push(`| 📋 Value Issues | ${result.valueIssues.length} | ${result.valueIssues.length > 0 ? '🟡 Medium' : '✅ None'} |`);
  lines.push(`| 📦 Deprecations | ${result.deprecations.length} | ${result.deprecations.length > 0 ? '🔵 Info' : '✅ None'} |`);
  lines.push('');

  if (totalIssues === 0) {
    lines.push('> ✨ **No issues found!** Your environment configuration is pristine.');
    return lines.join('\n');
  }

  // Secret Leaks
  if (result.secretLeaks.length > 0) {
    lines.push('## 🔓 Secret Leaks');
    lines.push('');
    lines.push('| Variable | Type | File | Severity |');
    lines.push('|----------|------|------|----------|');
    for (const leak of result.secretLeaks) {
      const relFile = path.relative(root, leak.file) || leak.file;
      lines.push(`| \`${leak.name}\` | ${leak.leakType} | \`${relFile}:${leak.line}\` | 🔴 ${leak.severity} |`);
    }
    lines.push('');
  }

  // Type Traps
  if (result.typeTraps.length > 0) {
    lines.push('## ⚠️ Type Traps');
    lines.push('');
    for (const trap of result.typeTraps) {
      const relEnv = path.relative(root, trap.envFile) || trap.envFile;
      lines.push(`- **\`${trap.name}\`** — ${trap.hazard}`);
      lines.push(`  - Value: \`${trap.envValue}\` in \`${relEnv}:${trap.envLine}\``);
      lines.push(`  - ${trap.description}`);
      lines.push(`  - 💡 ${trap.recommendation}`);
    }
    lines.push('');
  }

  // Missing Variables
  if (result.missing.length > 0) {
    lines.push('## 🚨 Missing Variables');
    lines.push('');
    lines.push('| Variable | Missing In | Suggested Default |');
    lines.push('|----------|-----------|-------------------|');
    for (const item of result.missing) {
      const missingIn = item.missingIn
        .map((m) => (m === 'active_env' ? '.env' : '.env.example'))
        .join(', ');
      lines.push(`| \`${item.name}\` | ${missingIn} | \`${item.suggestedDefault || ''}\` |`);
    }
    lines.push('');
  }

  // Zombie Variables
  if (result.zombies.length > 0) {
    lines.push('## 🧟 Zombie Variables');
    lines.push('');
    lines.push('| Variable | Action | Defined In |');
    lines.push('|----------|--------|-----------|');
    for (const zombie of result.zombies) {
      const action = zombie.suggestedAction === 'keep' ? '✅ Keep' : '🗑️ Prune';
      lines.push(`| \`${zombie.variable.name}\` | ${action} | ${zombie.filesDefined.join(', ')} |`);
    }
    lines.push('');
  }

  // Duplicates
  if (result.duplicates.length > 0) {
    lines.push('## 🔁 Duplicate Variables');
    lines.push('');
    for (const dup of result.duplicates) {
      const conflictBadge = dup.hasDifferentValues ? '⚠️ **Conflicting values!**' : '📋 Same value';
      lines.push(`- **\`${dup.name}\`** — ${conflictBadge}`);
      for (const d of dup.definitions) {
        const relFile = path.relative(root, d.file) || d.file;
        lines.push(`  - \`${relFile}:${d.line}\` → \`${d.value}\``);
      }
    }
    lines.push('');
  }

  // Value Issues
  if (result.valueIssues.length > 0) {
    lines.push('## 📋 Value Validation Issues');
    lines.push('');
    for (const issue of result.valueIssues) {
      lines.push(`- **\`${issue.name}\`** — ${issue.description}`);
      lines.push(`  - 💡 ${issue.suggestion}`);
    }
    lines.push('');
  }

  // Deprecations
  if (result.deprecations.length > 0) {
    lines.push('## 📦 Deprecated Variables');
    lines.push('');
    lines.push('| Variable | Framework | Replacement |');
    lines.push('|----------|-----------|-------------|');
    for (const dep of result.deprecations) {
      lines.push(`| \`${dep.name}\` | ${dep.framework} | \`${dep.replacement}\` |`);
    }
    lines.push('');
  }

  // Quick Fix
  lines.push('---');
  lines.push('');
  lines.push('## 💡 Quick Fixes');
  lines.push('');
  lines.push('```bash');
  lines.push('zombieconfig fix --sync-example   # Auto-add missing keys to .env.example');
  lines.push('zombieconfig fix --prune          # Safely comment out dead zombie variables');
  lines.push('zombieconfig generate --schema zod # Generate type-safe Zod schema');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
