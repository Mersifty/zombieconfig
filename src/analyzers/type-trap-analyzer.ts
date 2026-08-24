import type { EnvVariableDefinition, CodeEnvUsage, TypeTrapIssue } from '../types.js';

export function analyzeTypeTraps(
  definitions: EnvVariableDefinition[],
  usages: CodeEnvUsage[]
): TypeTrapIssue[] {
  const issues: TypeTrapIssue[] = [];

  const defMap = new Map<string, EnvVariableDefinition[]>();
  for (const def of definitions) {
    if (!defMap.has(def.name)) {
      defMap.set(def.name, []);
    }
    defMap.get(def.name)!.push(def);
  }

  for (const usage of usages) {
    const defs = defMap.get(usage.name);
    if (!defs || defs.length === 0) continue;

    for (const def of defs) {
      const valLower = def.value.toLowerCase().trim();

      // Check Boolean String Trap
      if (
        usage.isBooleanCheck &&
        (valLower === 'false' || valLower === '0' || valLower === 'no' || valLower === 'off')
      ) {
        issues.push({
          name: usage.name,
          envFile: def.file,
          envLine: def.line,
          envValue: def.value,
          codeUsage: usage,
          hazard: 'boolean_string_trap',
          description: `Environment variable "${usage.name}" is set to "${def.value}" in ${def.file}:${def.line}, but tested as truthy boolean in ${usage.file}:${usage.line}. In JavaScript/TypeScript, the string "${def.value}" is truthy!`,
          recommendation: `Use process.env.${usage.name} === 'true' or parse with a schema validator like Zod instead of direct boolean coercion.`,
        });
      }

      // Check Numeric Trap
      if (usage.isNumberCoercion && def.value !== '' && Number.isNaN(Number(def.value))) {
        issues.push({
          name: usage.name,
          envFile: def.file,
          envLine: def.line,
          envValue: def.value,
          codeUsage: usage,
          hazard: 'numeric_nan_trap',
          description: `Environment variable "${usage.name}" is set to non-numeric value "${def.value}", but code attempts numeric conversion (parseInt/Number) at ${usage.file}:${usage.line}.`,
          recommendation: `Provide a valid number in .env or add fallback: Number(process.env.${usage.name}) || DEFAULT_VALUE.`,
        });
      }
    }
  }

  return issues;
}
