import fs from 'node:fs/promises';
import path from 'node:path';
import type { ZombieConfigRC } from './types.js';

const CONFIG_FILE_NAMES = [
  '.zombieconfigrc.json',
  '.zombieconfigrc',
  'zombieconfig.config.json',
];

const DEFAULT_CONFIG: ZombieConfigRC = {
  minScore: 80,
  ignore: [],
  include: [],
  exclude: [],
  envPatterns: [],
  rules: {
    noSecrets: true,
    requireExample: true,
    noDuplicates: true,
    validateValues: true,
    checkDeprecations: true,
    maxZombies: -1,
  },
};

export async function loadConfig(cwd: string): Promise<ZombieConfigRC> {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = path.resolve(cwd, fileName);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<ZombieConfigRC>;

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        rules: {
          ...DEFAULT_CONFIG.rules,
          ...(parsed.rules || {}),
        },
      };
    } catch {
      // File doesn't exist or is invalid, continue to next
    }
  }

  // Also check package.json for "zombieconfig" key
  try {
    const pkgPath = path.resolve(cwd, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    if (pkg.zombieconfig && typeof pkg.zombieconfig === 'object') {
      return {
        ...DEFAULT_CONFIG,
        ...pkg.zombieconfig,
        rules: {
          ...DEFAULT_CONFIG.rules,
          ...(pkg.zombieconfig.rules || {}),
        },
      };
    }
  } catch {
    // No package.json or no zombieconfig key
  }

  return DEFAULT_CONFIG;
}

export async function initConfig(cwd: string): Promise<string> {
  const filePath = path.resolve(cwd, '.zombieconfigrc.json');
  const config: ZombieConfigRC = {
    minScore: 80,
    ignore: ['NODE_ENV', 'CI'],
    include: [],
    exclude: ['**/vendor/**', '**/node_modules/**'],
    envPatterns: [],
    rules: {
      noSecrets: true,
      requireExample: true,
      noDuplicates: true,
      validateValues: true,
      checkDeprecations: true,
      maxZombies: -1,
    },
  };

  await fs.writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return filePath;
}
