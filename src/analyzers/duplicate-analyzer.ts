import type { EnvVariableDefinition, DuplicateIssue } from '../types.js';

export function analyzeDuplicates(
  definitions: EnvVariableDefinition[]
): DuplicateIssue[] {
  const varMap = new Map<string, { file: string; line: number; value: string }[]>();

  for (const def of definitions) {
    if (def.isCommentedOut) continue;

    const key = def.name;
    if (!varMap.has(key)) {
      varMap.set(key, []);
    }
    varMap.get(key)!.push({
      file: def.file,
      line: def.line,
      value: def.value,
    });
  }

  const issues: DuplicateIssue[] = [];

  for (const [name, defs] of varMap.entries()) {
    // Only report if defined in more than one file (not just repeated in same file)
    const uniqueFiles = new Set(defs.map((d) => d.file));
    if (uniqueFiles.size < 2) continue;

    const uniqueValues = new Set(defs.map((d) => d.value));
    issues.push({
      name,
      definitions: defs,
      hasDifferentValues: uniqueValues.size > 1,
    });
  }

  return issues;
}
