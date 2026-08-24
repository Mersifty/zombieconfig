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
  healthScore: number; // 0 - 100
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
