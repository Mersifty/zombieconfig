import type { EnvVariableDefinition, DeprecationIssue } from '../types.js';

interface DeprecationRule {
  pattern: RegExp;
  framework: string;
  replacement: string;
  description: string;
}

const DEPRECATION_RULES: DeprecationRule[] = [
  // React (CRA → Vite migration)
  {
    pattern: /^REACT_APP_/,
    framework: 'Create React App → Vite',
    replacement: 'VITE_',
    description: 'CRA-style env variables (REACT_APP_*) are deprecated. Vite uses VITE_* prefix.',
  },
  // Next.js (old pattern)
  {
    pattern: /^NEXT_PUBLIC_ANALYTICS_ID$/,
    framework: 'Next.js',
    replacement: 'NEXT_PUBLIC_MEASUREMENT_ID',
    description: 'Google Analytics ID naming convention has been updated.',
  },
  // Gatsby
  {
    pattern: /^GATSBY_/,
    framework: 'Gatsby → Modern frameworks',
    replacement: 'VITE_ or NEXT_PUBLIC_',
    description: 'Gatsby-style env variables suggest a legacy Gatsby setup. Consider migration.',
  },
  // Old MongoDB URI format
  {
    pattern: /^MONGO_URI$/,
    framework: 'MongoDB',
    replacement: 'MONGODB_URI or DATABASE_URL',
    description: 'MONGO_URI is a legacy convention. Modern ORMs prefer MONGODB_URI or DATABASE_URL.',
  },
  {
    pattern: /^MONGOLAB_URI$/,
    framework: 'MongoDB (Heroku)',
    replacement: 'MONGODB_URI',
    description: 'MONGOLAB_URI is a deprecated Heroku addon name. Use MONGODB_URI instead.',
  },
  // Heroku legacy
  {
    pattern: /^CLEARDB_DATABASE_URL$/,
    framework: 'Heroku ClearDB',
    replacement: 'DATABASE_URL',
    description: 'CLEARDB_DATABASE_URL is a legacy Heroku MySQL addon. Use DATABASE_URL.',
  },
  // AWS legacy patterns
  {
    pattern: /^AWS_ACCESS_KEY$/,
    framework: 'AWS',
    replacement: 'AWS_ACCESS_KEY_ID',
    description: 'AWS_ACCESS_KEY is non-standard. Use AWS_ACCESS_KEY_ID per AWS SDK conventions.',
  },
  {
    pattern: /^AWS_SECRET_KEY$/,
    framework: 'AWS',
    replacement: 'AWS_SECRET_ACCESS_KEY',
    description: 'AWS_SECRET_KEY is non-standard. Use AWS_SECRET_ACCESS_KEY per AWS SDK conventions.',
  },
  // Twitter API
  {
    pattern: /^TWITTER_/,
    framework: 'Twitter → X',
    replacement: 'X_ (or keep TWITTER_ if SDK requires)',
    description: 'Twitter has rebranded to X. Some newer SDKs use X_ prefix.',
  },
  // Generic deprecations
  {
    pattern: /^DB_HOST$/,
    framework: 'Database',
    replacement: 'DATABASE_URL',
    description: 'Splitting DB config into DB_HOST/DB_PORT/DB_NAME is fragile. Prefer a single DATABASE_URL connection string.',
  },
  {
    pattern: /^DB_PORT$/,
    framework: 'Database',
    replacement: 'DATABASE_URL',
    description: 'Individual DB_PORT is fragile. Consider a single DATABASE_URL connection string.',
  },
  {
    pattern: /^DB_NAME$/,
    framework: 'Database',
    replacement: 'DATABASE_URL',
    description: 'Individual DB_NAME is fragile. Consider a single DATABASE_URL connection string.',
  },
  {
    pattern: /^DB_USER$/,
    framework: 'Database',
    replacement: 'DATABASE_URL',
    description: 'Individual DB_USER is fragile. Consider a single DATABASE_URL connection string.',
  },
  {
    pattern: /^DB_PASSWORD$/,
    framework: 'Database',
    replacement: 'DATABASE_URL',
    description: 'Individual DB_PASSWORD is fragile. Consider a single DATABASE_URL connection string.',
  },
];

export function analyzeDeprecations(
  definitions: EnvVariableDefinition[]
): DeprecationIssue[] {
  const issues: DeprecationIssue[] = [];
  const seenNames = new Set<string>();

  for (const def of definitions) {
    if (def.isCommentedOut) continue;
    if (seenNames.has(def.name)) continue;
    seenNames.add(def.name);

    for (const rule of DEPRECATION_RULES) {
      if (rule.pattern.test(def.name)) {
        issues.push({
          name: def.name,
          file: def.file,
          line: def.line,
          framework: rule.framework,
          replacement: rule.replacement,
          description: rule.description,
        });
        break;
      }
    }
  }

  return issues;
}
