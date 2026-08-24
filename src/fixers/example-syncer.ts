import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuditResult } from '../types.js';

export async function syncExampleFile(
  result: AuditResult,
  targetFile?: string
): Promise<{ filePath: string; addedKeys: string[]; created: boolean }> {
  const root = result.rootDirectory;
  const exampleFilePath = targetFile
    ? path.resolve(root, targetFile)
    : path.resolve(root, '.env.example');

  let content = '';
  let created = false;

  try {
    content = await fs.readFile(exampleFilePath, 'utf-8');
  } catch {
    created = true;
    content = '# Environment configuration template\n';
  }

  const existingLines = content.split(/\r?\n/);
  const existingKeys = new Set<string>();

  for (const line of existingLines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      existingKeys.add(match[1]);
    }
  }

  // Find all variables that should be in example:
  // 1. Used in code
  // 2. Or defined in active .env
  const allNeededVars = new Map<string, string>();

  for (const usage of result.codeUsages) {
    if (!existingKeys.has(usage.name) && !allNeededVars.has(usage.name)) {
      const missingItem = result.missing.find((m) => m.name === usage.name);
      allNeededVars.set(usage.name, missingItem?.suggestedDefault || '');
    }
  }

  for (const def of result.definedVariables) {
    if (!def.isExample && !def.isCommentedOut && !existingKeys.has(def.name) && !allNeededVars.has(def.name)) {
      allNeededVars.set(def.name, '');
    }
  }

  const addedKeys: string[] = [];
  const appendLines: string[] = [];

  if (allNeededVars.size > 0) {
    if (content.trim().length > 0 && !content.endsWith('\n')) {
      appendLines.push('');
    }
    appendLines.push('\n# Added by GhostConfig sync');

    for (const [key, defaultVal] of allNeededVars.entries()) {
      appendLines.push(`${key}=${defaultVal}`);
      addedKeys.push(key);
    }
  }

  if (created || addedKeys.length > 0) {
    await fs.writeFile(exampleFilePath, content + appendLines.join('\n') + '\n', 'utf-8');
  }

  return {
    filePath: exampleFilePath,
    addedKeys,
    created,
  };
}
