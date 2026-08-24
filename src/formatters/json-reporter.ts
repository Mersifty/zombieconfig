import type { AuditResult } from '../types.js';

export function formatJsonReport(result: AuditResult): string {
  return JSON.stringify(
    {
      summary: {
        healthScore: result.healthScore,
        scannedEnvFilesCount: result.scannedEnvFiles.length,
        scannedCodeFilesCount: result.scannedCodeFilesCount,
        definedVariablesCount: result.definedVariables.length,
        codeUsagesCount: result.codeUsages.length,
        zombiesCount: result.zombies.length,
        missingCount: result.missing.length,
        typeTrapsCount: result.typeTraps.length,
        secretLeaksCount: result.secretLeaks.length,
        executionTimeMs: result.executionTimeMs,
      },
      scannedEnvFiles: result.scannedEnvFiles,
      secretLeaks: result.secretLeaks,
      typeTraps: result.typeTraps,
      missing: result.missing.map((m) => ({
        name: m.name,
        missingIn: m.missingIn,
        suggestedDefault: m.suggestedDefault,
        occurrencesCount: m.occurrences.length,
        occurrences: m.occurrences.map((o) => ({
          file: o.file,
          line: o.line,
          language: o.language,
          codeSnippet: o.codeSnippet,
        })),
      })),
      zombies: result.zombies.map((z) => ({
        name: z.variable.name,
        value: z.variable.value,
        files: z.filesDefined,
        suggestedAction: z.suggestedAction,
      })),
    },
    null,
    2
  );
}
