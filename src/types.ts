export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'java'
  | 'csharp'
  | 'shell'
  | 'docker'
  | 'yaml'
  | 'elixir'
  | 'swift'
  | 'terraform'
  | 'other';

export interface EnvVariableDefinition {
  name: string;
  value: string;
  file: string;
  line: number;
  isExample: boolean;
  isCommentedOut: boolean;
  rawLine: string;
}

export interface CodeEnvUsage {
  name: string;
  file: string;
  line: number;
  column: number;
  codeSnippet: string;
  accessPattern: string;
  language: SupportedLanguage;
  isBooleanCheck?: boolean;
  isNumberCoercion?: boolean;
}

export interface ZombieIssue {
  variable: EnvVariableDefinition;
  filesDefined: string[];
  suggestedAction: 'remove' | 'comment_out' | 'keep';
}

export interface MissingIssue {
  name: string;
  occurrences: CodeEnvUsage[];
  missingIn: ('active_env' | 'example_env')[];
  suggestedDefault?: string;
}

export interface TypeTrapIssue {
  name: string;
  envFile: string;
  envLine: number;
  envValue: string;
  codeUsage: CodeEnvUsage;
  hazard: 'boolean_string_trap' | 'numeric_nan_trap' | 'empty_string_trap';
  description: string;
  recommendation: string;
}

export interface SecretLeakIssue {
  name: string;
  file: string;
  line: number;
  value: string;
  leakType: string;
  severity: 'critical' | 'high' | 'medium';
}

// v2.0 — New Issue Types

export interface DuplicateIssue {
  name: string;
  definitions: {
    file: string;
    line: number;
    value: string;
  }[];
  hasDifferentValues: boolean;
}

export interface ValueValidationIssue {
  name: string;
  value: string;
  file: string;
  line: number;
  rule: 'invalid_url' | 'invalid_port' | 'empty_required' | 'invalid_email' | 'suspicious_placeholder';
  description: string;
  suggestion: string;
}

export interface DeprecationIssue {
  name: string;
  file: string;
  line: number;
  framework: string;
  replacement: string;
  description: string;
}

export type HealthGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface AuditResult {
  rootDirectory: string;
  scannedEnvFiles: string[];
  scannedCodeFilesCount: number;
  definedVariables: EnvVariableDefinition[];
  codeUsages: CodeEnvUsage[];
  zombies: ZombieIssue[];
  missing: MissingIssue[];
  typeTraps: TypeTrapIssue[];
  secretLeaks: SecretLeakIssue[];
  duplicates: DuplicateIssue[];
  valueIssues: ValueValidationIssue[];
  deprecations: DeprecationIssue[];
  healthScore: number; // 0 - 100
  healthGrade: HealthGrade;
  executionTimeMs: number;
}

export interface ScanOptions {
  cwd?: string;
  include?: string[];
  exclude?: string[];
  envFiles?: string[];
  strict?: boolean;
  fix?: boolean;
  ci?: boolean;
  format?: 'pretty' | 'json' | 'markdown';
}

// Project config file (.zombieconfigrc.json)
export interface ZombieConfigRC {
  minScore?: number;
  ignore?: string[];
  include?: string[];
  exclude?: string[];
  envPatterns?: string[];
  rules?: {
    noSecrets?: boolean;
    requireExample?: boolean;
    noDuplicates?: boolean;
    validateValues?: boolean;
    checkDeprecations?: boolean;
    maxZombies?: number;
  };
}
