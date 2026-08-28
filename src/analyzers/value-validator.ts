import type { EnvVariableDefinition, ValueValidationIssue } from '../types.js';

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidPort(value: string): boolean {
  const num = parseInt(value, 10);
  return !Number.isNaN(num) && num >= 0 && num <= 65535;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const URL_HINTS = ['URL', 'URI', 'ENDPOINT', 'WEBHOOK', 'CALLBACK', 'REDIRECT', 'ORIGIN', 'HREF'];
const PORT_HINTS = ['PORT'];
const EMAIL_HINTS = ['EMAIL', 'SMTP_FROM', 'MAIL_FROM', 'SENDER', 'RECIPIENT'];
const REQUIRED_HINTS = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'API_KEY', 'AUTH'];

const SUSPICIOUS_PLACEHOLDERS = [
  'todo', 'fixme', 'changeme', 'xxx', 'replace_me',
  'your_', 'insert_', 'add_your', 'put_your', 'enter_',
  'CHANGE_THIS', '<your', '{your', '${', '{{',
];

export function analyzeValues(
  definitions: EnvVariableDefinition[]
): ValueValidationIssue[] {
  const issues: ValueValidationIssue[] = [];

  for (const def of definitions) {
    if (def.isCommentedOut) continue;
    const upper = def.name.toUpperCase();

    // URL validation
    if (URL_HINTS.some((h) => upper.includes(h)) && def.value.length > 0) {
      if (!isValidUrl(def.value) && !def.value.startsWith('$') && !def.value.includes('${')) {
        issues.push({
          name: def.name,
          value: def.value,
          file: def.file,
          line: def.line,
          rule: 'invalid_url',
          description: `"${def.name}" appears to be a URL variable but its value "${def.value}" is not a valid URL.`,
          suggestion: `Ensure the value starts with a protocol (e.g. http://, https://, postgresql://, redis://).`,
        });
      }
    }

    // Port validation
    if (PORT_HINTS.some((h) => upper.includes(h)) && def.value.length > 0) {
      if (!isValidPort(def.value)) {
        issues.push({
          name: def.name,
          value: def.value,
          file: def.file,
          line: def.line,
          rule: 'invalid_port',
          description: `"${def.name}" appears to be a port but "${def.value}" is not a valid port number (0–65535).`,
          suggestion: `Use a valid port number between 0 and 65535.`,
        });
      }
    }

    // Email validation
    if (EMAIL_HINTS.some((h) => upper.includes(h)) && def.value.length > 0) {
      if (!isValidEmail(def.value) && !def.value.startsWith('$') && !def.value.includes('${')) {
        issues.push({
          name: def.name,
          value: def.value,
          file: def.file,
          line: def.line,
          rule: 'invalid_email',
          description: `"${def.name}" appears to be an email variable but "${def.value}" is not a valid email address.`,
          suggestion: `Provide a valid email address format.`,
        });
      }
    }

    // Empty required value
    if (
      !def.isExample &&
      def.value === '' &&
      REQUIRED_HINTS.some((h) => upper.includes(h))
    ) {
      issues.push({
        name: def.name,
        value: def.value,
        file: def.file,
        line: def.line,
        rule: 'empty_required',
        description: `"${def.name}" looks like a required secret/credential but is empty in active .env.`,
        suggestion: `Provide a valid value or use a secret manager.`,
      });
    }

    // Suspicious placeholder in non-example file
    if (!def.isExample && def.value.length > 0) {
      const lower = def.value.toLowerCase();
      if (SUSPICIOUS_PLACEHOLDERS.some((p) => lower.includes(p.toLowerCase()))) {
        issues.push({
          name: def.name,
          value: def.value,
          file: def.file,
          line: def.line,
          rule: 'suspicious_placeholder',
          description: `"${def.name}" contains a placeholder-like value "${def.value}" in active .env — this may not be a real value.`,
          suggestion: `Replace with the actual credential or configuration value.`,
        });
      }
    }
  }

  return issues;
}
