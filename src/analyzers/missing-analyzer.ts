import type { EnvVariableDefinition, CodeEnvUsage, MissingIssue } from '../types.js';

function guessDefaultValue(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('PORT')) return '3000';
  if (upper.includes('HOST')) return 'localhost';
  if (upper.startsWith('IS_') || upper.startsWith('ENABLE_') || upper.startsWith('USE_') || upper.startsWith('DEBUG')) {
    return 'false';
  }
  if (upper.includes('URL') || upper.includes('URI')) {
    if (upper.includes('DATABASE') || upper.includes('DB')) return 'postgresql://user:password@localhost:5432/dbname';
    if (upper.includes('REDIS')) return 'redis://localhost:6379';
    return 'http://localhost:3000';
  }
  if (upper.includes('KEY') || upper.includes('SECRET') || upper.includes('TOKEN')) {
    return 'your_' + name.toLowerCase() + '_here';
  }
  if (upper.includes('TIMEOUT') || upper.includes('TTL')) return '5000';
  if (upper.includes('LIMIT') || upper.includes('COUNT')) return '10';
  return '';
}

export function analyzeMissing(
  definitions: EnvVariableDefinition[],
  usages: CodeEnvUsage[]
): MissingIssue[] {
  const activeEnvNames = new Set(
    definitions.filter((d) => !d.isExample && !d.isCommentedOut).map((d) => d.name)
  );
  const exampleEnvNames = new Set(
    definitions.filter((d) => d.isExample).map((d) => d.name)
  );

  // Group usages by variable name
  const usageMap = new Map<string, CodeEnvUsage[]>();
  for (const usage of usages) {
    if (!usageMap.has(usage.name)) {
      usageMap.set(usage.name, []);
    }
    usageMap.get(usage.name)!.push(usage);
  }

  const issues: MissingIssue[] = [];

  for (const [varName, codeUsages] of usageMap.entries()) {
    const missingIn: ('active_env' | 'example_env')[] = [];

    // If active env files exist, check if missing
    if (activeEnvNames.size > 0 && !activeEnvNames.has(varName)) {
      missingIn.push('active_env');
    }

    // Check if missing in .env.example
    if (!exampleEnvNames.has(varName)) {
      missingIn.push('example_env');
    }

    if (missingIn.length > 0) {
      issues.push({
        name: varName,
        occurrences: codeUsages,
        missingIn,
        suggestedDefault: guessDefaultValue(varName),
      });
    }
  }

  return issues;
}
