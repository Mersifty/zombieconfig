import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { runAudit } from './index.js';
import { formatTerminalReport } from './formatters/terminal-ui.js';
import { formatJsonReport } from './formatters/json-reporter.js';
import { formatMarkdownReport } from './formatters/markdown-reporter.js';
import { generateZodSchema, generateTypeScriptDeclaration } from './formatters/schema-gen.js';
import { syncExampleFile } from './fixers/example-syncer.js';
import { pruneZombieVariables } from './fixers/env-pruner.js';
import { parseEnvFile } from './scanners/env-scanner.js';
import { initConfig } from './config-loader.js';
import { startWatchMode } from './watcher.js';

const program = new Command();

program
  .name('zombieconfig')
  .description('Zero-config Zombie Env & Ghost Variable Hunter for developers and CI/CD')
  .version('2.0.0');

// 1. Default Scan Command
program
  .command('scan', { isDefault: true })
  .description('Audit the project for zombie variables, missing env vars, type traps, and leaks')
  .option('-d, --cwd <path>', 'Working directory to audit', process.cwd())
  .option('-f, --format <format>', 'Output format (pretty | json | markdown)', 'pretty')
  .option('-w, --watch', 'Watch mode: automatically re-scan on file changes', false)
  .option('--ci', 'Run in CI mode (exits with non-zero code on failure)', false)
  .option('--strict', 'Strict mode: fail on any warning or zombie variable', false)
  .option('--min-score <score>', 'Minimum health score required (0-100)', '80')
  .action(async (options) => {
    try {
      if (options.watch) {
        startWatchMode({
          cwd: options.cwd,
          format: options.format,
        });
        return;
      }

      const minScore = parseInt(options.minScore, 10) || 80;
      const result = await runAudit({
        cwd: options.cwd,
        ci: options.ci,
        strict: options.strict,
      });

      if (options.format === 'json') {
        console.log(formatJsonReport(result));
      } else if (options.format === 'markdown' || options.format === 'md') {
        console.log(formatMarkdownReport(result));
      } else {
        console.log(formatTerminalReport(result));
      }

      if (options.ci || options.strict) {
        const hasCritical = result.secretLeaks.some((s) => s.severity === 'critical');
        const hasTypeTraps = result.typeTraps.length > 0;
        const hasMissingActive = result.missing.some((m) => m.missingIn.includes('active_env'));

        if (options.strict && (result.zombies.length > 0 || result.missing.length > 0 || result.duplicates.some(d => d.hasDifferentValues))) {
          console.error(pc.red('\n❌ CI Strict Check Failed: Found zombie, missing, or conflicting variables.'));
          process.exit(1);
        }

        if (result.healthScore < minScore || hasCritical || hasTypeTraps || hasMissingActive) {
          console.error(pc.red(`\n❌ CI Check Failed: Health score ${result.healthScore} is below threshold ${minScore} or critical issues exist.`));
          process.exit(1);
        }
      }
    } catch (err: any) {
      console.error(pc.red(`Error running zombieconfig scan: ${err?.message || err}`));
      process.exit(1);
    }
  });

// 2. Diff Command (Compare two env files)
program
  .command('diff <fileA> <fileB>')
  .description('Compare environment variables between two .env files')
  .option('-d, --cwd <path>', 'Working directory', process.cwd())
  .action(async (fileA, fileB, options) => {
    try {
      const pathA = path.resolve(options.cwd, fileA);
      const pathB = path.resolve(options.cwd, fileB);

      const defsA = await parseEnvFile(pathA);
      const defsB = await parseEnvFile(pathB);

      const mapA = new Map(defsA.filter((d) => !d.isCommentedOut).map((d) => [d.name, d.value]));
      const mapB = new Map(defsB.filter((d) => !d.isCommentedOut).map((d) => [d.name, d.value]));

      const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

      console.log(pc.bold(pc.cyan(`\n🔍 Comparing: ${pc.yellow(fileA)} ↔ ${pc.magenta(fileB)}\n`)));

      let added = 0;
      let removed = 0;
      let changed = 0;
      let identical = 0;

      for (const key of allKeys) {
        const valA = mapA.get(key);
        const valB = mapB.get(key);

        if (valA !== undefined && valB === undefined) {
          console.log(`  ${pc.red('-')} ${pc.bold(key)}: ${pc.red(`"${valA}"`)} ${pc.gray(`(only in ${fileA})`)}`);
          removed++;
        } else if (valA === undefined && valB !== undefined) {
          console.log(`  ${pc.green('+')} ${pc.bold(key)}: ${pc.green(`"${valB}"`)} ${pc.gray(`(only in ${fileB})`)}`);
          added++;
        } else if (valA !== valB) {
          console.log(`  ${pc.yellow('~')} ${pc.bold(key)}: ${pc.red(`"${valA}"`)} → ${pc.green(`"${valB}"`)}`);
          changed++;
        } else {
          identical++;
        }
      }

      console.log(pc.gray('\n---'));
      console.log(
        `Summary: ${pc.green(`+${added} added`)}, ${pc.red(`-${removed} removed`)}, ${pc.yellow(`~${changed} modified`)}, ${pc.gray(`${identical} matching`)}\n`
      );
    } catch (err: any) {
      console.error(pc.red(`Error comparing env files: ${err?.message || err}`));
      process.exit(1);
    }
  });

// 3. Doctor Command (Comprehensive diagnostic)
program
  .command('doctor')
  .description('Perform a deep diagnostic check of your environment variable health with actionable recommendations')
  .option('-d, --cwd <path>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      const result = await runAudit({ cwd: options.cwd });

      console.log(pc.bold(pc.cyan(`\n🩺 ZOMBIECONFIG DOCTOR — Environment Health Diagnosis\n`)));
      console.log(`   Overall Grade : ${pc.bold(result.healthGrade)} (${result.healthScore}/100)`);
      console.log(`   Files Scanned : ${result.scannedCodeFilesCount} source code files, ${result.scannedEnvFiles.length} config files`);
      console.log(`   Variables     : ${result.definedVariables.length} configured | ${result.codeUsages.length} code references\n`);

      console.log(pc.bold('📋 Diagnostic Breakdown:'));
      console.log(`   ${result.secretLeaks.length === 0 ? pc.green('✔') : pc.red('✖')} Secret Leaks       : ${result.secretLeaks.length}`);
      console.log(`   ${result.typeTraps.length === 0 ? pc.green('✔') : pc.yellow('⚠')} Boolean/Type Traps : ${result.typeTraps.length}`);
      console.log(`   ${result.missing.length === 0 ? pc.green('✔') : pc.red('✖')} Missing Variables  : ${result.missing.length}`);
      console.log(`   ${result.zombies.length === 0 ? pc.green('✔') : pc.magenta('🧟')} Zombie Variables   : ${result.zombies.length}`);
      console.log(`   ${result.duplicates.length === 0 ? pc.green('✔') : pc.yellow('⚠')} Duplicate Conflicts: ${result.duplicates.length}`);
      console.log(`   ${result.valueIssues.length === 0 ? pc.green('✔') : pc.blue('ℹ')} Value Format Issues: ${result.valueIssues.length}`);
      console.log(`   ${result.deprecations.length === 0 ? pc.green('✔') : pc.cyan('ℹ')} Deprecated Patterns: ${result.deprecations.length}\n`);

      console.log(pc.bold('💡 Prescriptions & Next Steps:'));
      if (result.secretLeaks.length > 0) {
        console.log(`   ${pc.red('1.')} Immediately remove exposed secrets from public/template files.`);
      }
      if (result.missing.length > 0) {
        console.log(`   ${pc.yellow('2.')} Run ${pc.cyan('zombieconfig fix --sync-example')} to sync missing keys.`);
      }
      if (result.zombies.length > 0) {
        console.log(`   ${pc.magenta('3.')} Run ${pc.cyan('zombieconfig fix --prune')} to archive unused variables.`);
      }
      if (result.typeTraps.length > 0) {
        console.log(`   ${pc.yellow('4.')} Fix boolean comparisons in code (use strict '=== "true"').`);
      }
      if (result.healthScore >= 90) {
        console.log(`   ${pc.green('🎉 Your project environment configuration is in pristine health!')}`);
      }
      console.log('');
    } catch (err: any) {
      console.error(pc.red(`Error running doctor check: ${err?.message || err}`));
      process.exit(1);
    }
  });

// 4. Init Command
program
  .command('init')
  .description('Initialize .zombieconfigrc.json config and/or generate initial .env.example')
  .option('-d, --cwd <path>', 'Working directory', process.cwd())
  .option('--config-only', 'Only create .zombieconfigrc.json configuration file', false)
  .action(async (options) => {
    try {
      const configPath = await initConfig(options.cwd);
      console.log(pc.green(`✔ Created configuration file: ${path.relative(options.cwd, configPath)}`));

      if (!options.configOnly) {
        const result = await runAudit({ cwd: options.cwd });
        const res = await syncExampleFile(result);
        console.log(pc.green(`✔ Generated/Synced .env.example with ${res.addedKeys.length} variables detected across your codebase.`));
      }
    } catch (err: any) {
      console.error(pc.red(`Error during initialization: ${err?.message || err}`));
      process.exit(1);
    }
  });

// 5. Fix Command
program
  .command('fix')
  .description('Automatically resolve missing .env.example keys or archive zombie variables')
  .option('-d, --cwd <path>', 'Working directory', process.cwd())
  .option('--sync-example', 'Automatically create/update .env.example with missing variables', false)
  .option('--prune', 'Safely comment out zombie variables from active .env files', false)
  .option('--remove', 'Permanently remove zombie lines instead of commenting out', false)
  .option('--all', 'Perform all fixes (sync-example and prune)', false)
  .action(async (options) => {
    try {
      const result = await runAudit({ cwd: options.cwd });
      let performedAction = false;

      if (options.all || options.syncExample) {
        performedAction = true;
        const res = await syncExampleFile(result);
        if (res.addedKeys.length > 0) {
          console.log(pc.green(`✔ Synced ${path.relative(result.rootDirectory, res.filePath)}: added ${res.addedKeys.length} variables (${res.addedKeys.join(', ')})`));
        } else {
          console.log(pc.gray(`ℹ .env.example is already up to date.`));
        }
      }

      if (options.all || options.prune || options.remove) {
        performedAction = true;
        const res = await pruneZombieVariables(result, { remove: options.remove });
        if (res.prunedCount > 0) {
          console.log(pc.green(`✔ Archived ${res.prunedCount} zombie variable(s) across ${res.modifiedFiles.length} file(s).`));
        } else {
          console.log(pc.gray(`ℹ No zombie variables to prune.`));
        }
      }

      if (!performedAction) {
        console.log(pc.yellow('Please specify a fix action:'));
        console.log(`  ${pc.cyan('zombieconfig fix --sync-example')} : Update .env.example`);
        console.log(`  ${pc.cyan('zombieconfig fix --prune')}        : Safely comment out dead variables in .env`);
        console.log(`  ${pc.cyan('zombieconfig fix --all')}          : Perform all automatic fixes`);
      }
    } catch (err: any) {
      console.error(pc.red(`Error applying fixes: ${err?.message || err}`));
      process.exit(1);
    }
  });

// 6. Generate Command
program
  .command('generate')
  .description('Generate type-safe Zod schema or TypeScript declarations from detected variables')
  .option('-d, --cwd <path>', 'Working directory', process.cwd())
  .option('-s, --schema <type>', 'Schema type to generate: "zod" or "ts"', 'zod')
  .option('-o, --out <file>', 'Output file path (optional, prints to stdout if omitted)')
  .action(async (options) => {
    try {
      const result = await runAudit({ cwd: options.cwd });
      let outputCode = '';

      if (options.schema === 'ts' || options.schema === 'typescript') {
        outputCode = generateTypeScriptDeclaration(result);
      } else {
        outputCode = generateZodSchema(result);
      }

      if (options.out) {
        const outPath = path.resolve(result.rootDirectory, options.out);
        await fs.writeFile(outPath, outputCode, 'utf-8');
        console.log(pc.green(`✔ Successfully generated ${options.schema} schema to: ${path.relative(result.rootDirectory, outPath)}`));
      } else {
        console.log(outputCode);
      }
    } catch (err: any) {
      console.error(pc.red(`Error generating schema: ${err?.message || err}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
