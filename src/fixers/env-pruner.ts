import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuditResult } from '../types.js';

export async function pruneZombieVariables(
  result: AuditResult,
  options: { remove?: boolean } = {}
): Promise<{ modifiedFiles: string[]; prunedCount: number }> {
  const zombieNames = new Set(
    result.zombies.filter((z) => z.suggestedAction === 'comment_out').map((z) => z.variable.name)
  );

  if (zombieNames.size === 0) {
    return { modifiedFiles: [], prunedCount: 0 };
  }

  const modifiedFiles: string[] = [];
  let prunedCount = 0;

  for (const envFile of result.scannedEnvFiles) {
    const baseName = path.basename(envFile).toLowerCase();
    // Only modify active .env files, not .example/.template/.sample
    if (baseName.includes('example') || baseName.includes('template') || baseName.includes('sample')) {
      continue;
    }

    try {
      const content = await fs.readFile(envFile, 'utf-8');
      const lines = content.split(/\r?\n/);
      let fileModified = false;
      const newLines: string[] = [];

      for (const line of lines) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (match && zombieNames.has(match[1])) {
          fileModified = true;
          prunedCount++;
          if (options.remove) {
            // Drop the line completely
            continue;
          } else {
            // Comment out safely
            newLines.push(`# [ZOMBIE-ARCHIVED by ghostconfig] ${line}`);
            continue;
          }
        }
        newLines.push(line);
      }

      if (fileModified) {
        await fs.writeFile(envFile, newLines.join('\n'), 'utf-8');
        modifiedFiles.push(envFile);
      }
    } catch {
      // Ignore read/write errors for non-standard files
    }
  }

  return {
    modifiedFiles,
    prunedCount,
  };
}
