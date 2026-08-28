import path from 'node:path';
import { scanAllEnvFiles } from './scanners/env-scanner.js';
import { scanAllCodeFiles } from './scanners/code-scanner.js';
import { analyzeZombies } from './analyzers/zombie-analyzer.js';
import { analyzeMissing } from './analyzers/missing-analyzer.js';
import { analyzeTypeTraps } from './analyzers/type-trap-analyzer.js';
import { analyzeSecrets } from './analyzers/secret-analyzer.js';
import { analyzeDuplicates } from './analyzers/duplicate-analyzer.js';
import { analyzeValues } from './analyzers/value-validator.js';
import { analyzeDeprecations } from './analyzers/deprecation-analyzer.js';
import { loadConfig } from './config-loader.js';
import type { AuditResult, HealthGrade, ScanOptions } from './types.js';

function computeGrade(score: number): HealthGrade {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export async function runAudit(options: ScanOptions = {}): Promise<AuditResult> {
  const startTime = Date.now();
  const cwd = path.resolve(options.cwd || process.cwd());

  // Load project config (.zombieconfigrc.json or package.json)
  const config = await loadConfig(cwd);

  const excludePatterns = [
    ...(config.exclude || []),
    ...(options.exclude || []),
  ];

  const includePatterns = [
    ...(config.include || []),
    ...(options.include || []),
  ];

  const envPatterns = [
    ...(config.envPatterns || []),
    ...(options.envFiles || []),
  ];

  // 1. Scan all environment files
  const { files: envFiles, definitions: allDefinitions } = await scanAllEnvFiles(
    cwd,
    envPatterns.length > 0 ? envPatterns : undefined,
    excludePatterns.length > 0 ? excludePatterns : undefined
  );

  // Filter out variables ignored in config
  const ignoreSet = new Set(config.ignore || []);
  const definitions = allDefinitions.filter((d) => !ignoreSet.has(d.name));

  // 2. Scan all code files
  const { files: codeFiles, usages: allUsages } = await scanAllCodeFiles(
    cwd,
    includePatterns.length > 0 ? includePatterns : undefined,
    excludePatterns.length > 0 ? excludePatterns : undefined
  );

  const usages = allUsages.filter((u) => !ignoreSet.has(u.name));

  // 3. Run all Analyzers
  const zombies = analyzeZombies(definitions, usages, cwd);
  const missing = analyzeMissing(definitions, usages);
  const typeTraps = analyzeTypeTraps(definitions, usages);
  const secretLeaks = (config.rules?.noSecrets ?? true) ? analyzeSecrets(definitions) : [];
  const duplicates = (config.rules?.noDuplicates ?? true) ? analyzeDuplicates(definitions) : [];
  const valueIssues = (config.rules?.validateValues ?? true) ? analyzeValues(definitions) : [];
  const deprecations = (config.rules?.checkDeprecations ?? true) ? analyzeDeprecations(definitions) : [];

  // 4. Calculate Health Score
  let penalty = 0;
  penalty += Math.min(25, zombies.filter((z) => z.suggestedAction === 'comment_out').length * 5);
  penalty += Math.min(30, missing.filter((m) => m.missingIn.includes('active_env')).length * 10);
  penalty += Math.min(20, missing.filter((m) => m.missingIn.includes('example_env')).length * 5);
  penalty += Math.min(30, typeTraps.length * 15);
  penalty += Math.min(50, secretLeaks.filter((s) => s.severity === 'critical').length * 25);
  penalty += Math.min(20, secretLeaks.filter((s) => s.severity === 'high').length * 10);
  penalty += Math.min(15, duplicates.filter((d) => d.hasDifferentValues).length * 8);
  penalty += Math.min(15, valueIssues.filter((v) => v.rule === 'empty_required').length * 5);
  penalty += Math.min(10, deprecations.length * 3);

  const healthScore = Math.max(0, 100 - penalty);
  const healthGrade = computeGrade(healthScore);
  const executionTimeMs = Date.now() - startTime;

  return {
    rootDirectory: cwd,
    scannedEnvFiles: envFiles,
    scannedCodeFilesCount: codeFiles.length,
    definedVariables: definitions,
    codeUsages: usages,
    zombies,
    missing,
    typeTraps,
    secretLeaks,
    duplicates,
    valueIssues,
    deprecations,
    healthScore,
    healthGrade,
    executionTimeMs,
  };
}

export * from './types.js';
export { loadConfig, initConfig } from './config-loader.js';
export { scanAllEnvFiles, parseEnvFile } from './scanners/env-scanner.js';
export { scanAllCodeFiles, scanCodeFile } from './scanners/code-scanner.js';
export { analyzeZombies } from './analyzers/zombie-analyzer.js';
export { analyzeMissing } from './analyzers/missing-analyzer.js';
export { analyzeTypeTraps } from './analyzers/type-trap-analyzer.js';
export { analyzeSecrets } from './analyzers/secret-analyzer.js';
export { analyzeDuplicates } from './analyzers/duplicate-analyzer.js';
export { analyzeValues } from './analyzers/value-validator.js';
export { analyzeDeprecations } from './analyzers/deprecation-analyzer.js';
export { syncExampleFile } from './fixers/example-syncer.js';
export { pruneZombieVariables } from './fixers/env-pruner.js';
export { generateZodSchema, generateTypeScriptDeclaration } from './formatters/schema-gen.js';
export { formatMarkdownReport } from './formatters/markdown-reporter.js';
export { formatJsonReport } from './formatters/json-reporter.js';
export { formatTerminalReport } from './formatters/terminal-ui.js';
