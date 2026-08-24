import path from 'node:path';
import type { EnvVariableDefinition, CodeEnvUsage, ZombieIssue } from '../types.js';

// Common runtime or tooling variables that may not be directly referenced in code
const KNOWN_RUNTIME_VARS = new Set([
  'NODE_ENV',
  'PORT',
  'HOST',
  'TZ',
  'DEBUG',
  'LOG_LEVEL',
  'CI',
  'HTTPS',
  'SSL_CERT_PATH',
  'SSL_KEY_PATH',
  'DATABASE_URL', // frequently read by ORM CLIs like Prisma/Drizzle directly
  'DIRECT_URL',
  'SHADOW_DATABASE_URL',
]);

export function analyzeZombies(
  definitions: EnvVariableDefinition[],
  usages: CodeEnvUsage[],
  rootDirectory: string
): ZombieIssue[] {
  const codeVarNames = new Set(usages.map((u) => u.name));
  const zombiesMap = new Map<string, { def: EnvVariableDefinition; files: Set<string> }>();

  for (const def of definitions) {
    if (def.isCommentedOut) continue;

    // If it's used in code or it's a known system/runtime variable that might be for external CLI
    if (!codeVarNames.has(def.name)) {
      const relPath = path.relative(rootDirectory, def.file) || def.file;

      if (!zombiesMap.has(def.name)) {
        zombiesMap.set(def.name, {
          def,
          files: new Set([relPath]),
        });
      } else {
        zombiesMap.get(def.name)!.files.add(relPath);
      }
    }
  }

  const issues: ZombieIssue[] = [];

  for (const [_, data] of zombiesMap.entries()) {
    const isKnown = KNOWN_RUNTIME_VARS.has(data.def.name);
    issues.push({
      variable: data.def,
      filesDefined: Array.from(data.files),
      suggestedAction: isKnown ? 'keep' : 'comment_out',
    });
  }

  return issues;
}
