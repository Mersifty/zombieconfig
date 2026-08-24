import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { runAudit } from './index.js';
import { formatTerminalReport } from './formatters/terminal-ui.js';
import { formatJsonReport } from './formatters/json-reporter.js';
import { generateZodSchema, generateTypeScriptDeclaration } from './formatters/schema-gen.js';
import { syncExampleFile } from './fixers/example-syncer.js';
import { pruneZombieVariables } from './fixers/env-pruner.js';

const program = new Command();

program
  .name('ghostconfig')
  .description('Zero-config Zombie Env & Ghost Variable Hunter for developers and CI/CD')
  .version('1.0.0');

// Default Scan Command
program
  .command('scan', { isDefault: true })
  .description('Audit the project for zombie variables, missing env vars, type traps, and leaks')
  .option('-d, --cwd <path>', 'Working directory to audit', process.cwd())
  .option('-f, --format <format>', 'Output format (pretty | json)', 'pretty')
  .option('--ci', 'Run in CI mode (exits with non-zero code on failure)', false)
  .option('--strict', 'Strict mode: fail on any warning or zombie variable', false)
  .option('--min-score <score>', 'Minimum health score required (0-100)', '80')
  .action(async (options) => {
    try {
      const minScore = parseInt(options.minScore, 10) || 80;
      const result = await runAudit({
        cwd: options.cwd,
        ci: options.ci,
        strict: options.strict,
      });

      if (options.format === 'json') {
        console.log(formatJsonReport(result));
      } else {
        console.log(formatTerminalReport(result));
      }

      if (options.ci || options.strict) {
        const hasCritical = result.secretLeaks.some((s) => s.severity === 'critical');
        const hasTypeTraps = result.typeTraps.length > 0;
        const hasMissingActive = result.missing.some((m) => m.missingIn.includes('active_env'));

        if (options.strict && (result.zombies.length > 0 || result.missing.length > 0)) {
          console.error(pc.red('\n❌ CI Strict Check Failed: Found zombie or missing variables.'));
          process.exit(1);
        }

        if (result.healthScore < minScore || hasCritical || hasTypeTraps || hasMissingActive) {
          console.error(pc.red(`\n❌ CI Check Failed: Health score ${result.healthScore} is below threshold ${minScore} or critical issues exist.`));
          process.exit(1);
        }
      }
    } catch (err: any) {
      console.error(pc.red(`Error running ghostconfig scan: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Fix Command
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
        console.log(`  ${pc.cyan('ghostconfig fix --sync-example')} : Update .env.example`);
        console.log(`  ${pc.cyan('ghostconfig fix --prune')}        : Safely comment out dead variables in .env`);
        console.log(`  ${pc.cyan('ghostconfig fix --all')}          : Perform all automatic fixes`);
      }
    } catch (err: any) {
      console.error(pc.red(`Error applying fixes: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Generate Command
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
