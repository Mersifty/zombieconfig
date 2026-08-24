import path from 'node:path';
import { scanAllEnvFiles } from './scanners/env-scanner.js';
import { scanAllCodeFiles } from './scanners/code-scanner.js';
import { analyzeZombies } from './analyzers/zombie-analyzer.js';
import { analyzeMissing } from './analyzers/missing-analyzer.js';
import { analyzeTypeTraps } from './analyzers/type-trap-analyzer.js';
import { analyzeSecrets } from './analyzers/secret-analyzer.js';
import type { AuditResult, ScanOptions } from './types.js';

export async function runAudit(options: ScanOptions = {}): Promise<AuditResult> {
  const startTime = Date.now();
  const cwd = path.resolve(options.cwd || process.cwd());

  // 1. Scan all environment files
  const { files: envFiles, definitions } = await scanAllEnvFiles(cwd, options.envFiles, options.exclude);

  // 2. Scan all code files
  const { files: codeFiles, usages } = await scanAllCodeFiles(cwd, options.include, options.exclude);

  // 3. Analyze Issues
  const zombies = analyzeZombies(definitions, usages, cwd);
  const missing = analyzeMissing(definitions, usages);
  const typeTraps = analyzeTypeTraps(definitions, usages);
  const secretLeaks = analyzeSecrets(definitions);

  // 4. Calculate Health Score
  let penalty = 0;
  penalty += Math.min(25, zombies.filter((z) => z.suggestedAction === 'comment_out').length * 5);
  penalty += Math.min(30, missing.filter((m) => m.missingIn.includes('active_env')).length * 10);
  penalty += Math.min(20, missing.filter((m) => m.missingIn.includes('example_env')).length * 5);
  penalty += Math.min(30, typeTraps.length * 15);
  penalty += Math.min(50, secretLeaks.filter((s) => s.severity === 'critical').length * 25);
  penalty += Math.min(20, secretLeaks.filter((s) => s.severity === 'high').length * 10);

  const healthScore = Math.max(0, 100 - penalty);
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
    healthScore,
    executionTimeMs,
  };
}

export * from './types.js';
export { scanAllEnvFiles, parseEnvFile } from './scanners/env-scanner.js';
export { scanAllCodeFiles, scanCodeFile } from './scanners/code-scanner.js';
