import type { EnvVariableDefinition, SecretLeakIssue } from '../types.js';

interface SecretRule {
  name: string;
  regex: RegExp;
  severity: 'critical' | 'high' | 'medium';
}

const SECRET_RULES: SecretRule[] = [
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    severity: 'critical',
  },
  {
    name: 'OpenAI API Key',
    regex: /\b(sk-[a-zA-Z0-9_-]{20,})\b/,
    severity: 'critical',
  },
  {
    name: 'Anthropic API Key',
    regex: /\b(sk-ant-api[a-zA-Z0-9_-]{20,})\b/,
    severity: 'critical',
  },
  {
    name: 'Google API Key',
    regex: /\b(AIzaSy[a-zA-Z0-9_-]{33})\b/,
    severity: 'critical',
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{40,})\b/,
    severity: 'critical',
  },
  {
    name: 'Slack Token',
    regex: /\b(xox[baprs]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,})\b/,
    severity: 'critical',
  },
  {
    name: 'Stripe Live Secret Key',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,})\b/,
    severity: 'critical',
  },
  {
    name: 'Private RSA / SSH Key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    name: 'JSON Web Token (JWT)',
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/,
    severity: 'high',
  },
];

// Placeholder keywords that mean it's safely templated
const SAFE_PLACEHOLDERS = [
  'your_',
  'xxx',
  'test',
  'dummy',
  'example',
  'placeholder',
  'changeme',
  '<your',
  '{your',
  'replace_with',
];

function isSafePlaceholder(val: string): boolean {
  const lower = val.toLowerCase();
  return SAFE_PLACEHOLDERS.some((ph) => lower.includes(ph));
}

export function analyzeSecrets(definitions: EnvVariableDefinition[]): SecretLeakIssue[] {
  const issues: SecretLeakIssue[] = [];

  // Focus especially on .env.example, .env.template, or files committed to git
  for (const def of definitions) {
    if (def.isCommentedOut || !def.value) continue;
    if (isSafePlaceholder(def.value)) continue;

    for (const rule of SECRET_RULES) {
      if (rule.regex.test(def.value)) {
        issues.push({
          name: def.name,
          file: def.file,
          line: def.line,
          value: def.value.length > 8 ? `${def.value.slice(0, 4)}...${def.value.slice(-4)}` : '***',
          leakType: rule.name,
          severity: rule.severity,
        });
        break;
      }
    }

    // High entropy check for committed .example / .template files
    if (def.isExample && def.value.length >= 24 && !isSafePlaceholder(def.value)) {
      const isAlphanumericSecret = /^[A-Za-z0-9+/=_-]{24,}$/.test(def.value);
      if (isAlphanumericSecret && !issues.some((i) => i.name === def.name && i.file === def.file)) {
        issues.push({
          name: def.name,
          file: def.file,
          line: def.line,
          value: `${def.value.slice(0, 4)}...${def.value.slice(-4)}`,
          leakType: 'High-entropy secret in example template',
          severity: 'high',
        });
      }
    }
  }

  return issues;
}
