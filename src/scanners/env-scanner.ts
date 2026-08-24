import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { EnvVariableDefinition } from '../types.js';

const DEFAULT_ENV_PATTERNS = [
  '**/.env',
  '**/.env.*',
  '**/*.env',
  '**/docker-compose*.yml',
  '**/docker-compose*.yaml',
  '**/compose*.yml',
  '**/compose*.yaml',
];

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/vendor/**',
];

export async function findEnvFiles(
  cwd: string,
  customPatterns?: string[],
  customIgnore?: string[]
): Promise<string[]> {
  const patterns = customPatterns && customPatterns.length > 0 ? customPatterns : DEFAULT_ENV_PATTERNS;
  const ignore = customIgnore && customIgnore.length > 0 ? customIgnore : DEFAULT_IGNORE;

  const files = await fg(patterns, {
    cwd,
    ignore,
    dot: true,
    absolute: true,
    onlyFiles: true,
  });

  return files.sort();
}

export async function parseEnvFile(filePath: string): Promise<EnvVariableDefinition[]> {
  const definitions: EnvVariableDefinition[] = [];
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const fileName = path.basename(filePath).toLowerCase();
  const isExample = fileName.includes('example') || fileName.includes('template') || fileName.includes('sample');

  const isYaml = fileName.endsWith('.yml') || fileName.endsWith('.yaml');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    if (isYaml) {
      // Parse docker-compose / yaml environment sections
      // Matches e.g. - FOO=bar, - FOO, or FOO: bar
      const listMatch = trimmed.match(/^-\s*([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/);
      if (listMatch) {
        definitions.push({
          name: listMatch[1],
          value: listMatch[2] ?? '',
          file: filePath,
          line: lineNum,
          isExample,
          isCommentedOut: false,
          rawLine,
        });
        continue;
      }

      const mapMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (mapMatch && !['version', 'services', 'networks', 'volumes', 'environment', 'env_file', 'ports', 'image', 'build'].includes(mapMatch[1])) {
        // Check if under an environment block or looking like an env var (usually uppercase or standard)
        if (mapMatch[1] === mapMatch[1].toUpperCase() || mapMatch[1].includes('_')) {
          definitions.push({
            name: mapMatch[1],
            value: mapMatch[2].replace(/^['"]|['"]$/g, ''),
            file: filePath,
            line: lineNum,
            isExample,
            isCommentedOut: false,
            rawLine,
          });
        }
      }
      continue;
    }

    // Standard .env format
    const isCommented = trimmed.startsWith('#');
    const lineToParse = isCommented ? trimmed.replace(/^#+\s*/, '') : trimmed;

    // Support: `export KEY=value`, `KEY="value"`, `KEY=value`, `KEY=`
    const envMatch = lineToParse.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (envMatch) {
      const name = envMatch[1];
      let value = envMatch[2] ?? '';

      // Strip inline comments if not inside quotes
      if (!value.startsWith('"') && !value.startsWith("'")) {
        const commentIdx = value.indexOf(' #');
        if (commentIdx !== -1) {
          value = value.substring(0, commentIdx).trim();
        }
      } else {
        // Remove surrounding quotes
        value = value.replace(/^["'](.*)["']$/, '$1');
      }

      definitions.push({
        name,
        value,
        file: filePath,
        line: lineNum,
        isExample,
        isCommentedOut: isCommented,
        rawLine,
      });
    }
  }

  return definitions;
}

export async function scanAllEnvFiles(
  cwd: string,
  customPatterns?: string[],
  customIgnore?: string[]
): Promise<{ files: string[]; definitions: EnvVariableDefinition[] }> {
  const files = await findEnvFiles(cwd, customPatterns, customIgnore);
  const definitions: EnvVariableDefinition[] = [];

  for (const file of files) {
    const defs = await parseEnvFile(file);
    definitions.push(...defs);
  }

  return { files, definitions };
}
