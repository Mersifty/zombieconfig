import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { CodeEnvUsage, SupportedLanguage } from '../types.js';

const CODE_EXTENSIONS = [
  '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
  '**/*.py',
  '**/*.go',
  '**/*.rs',
  '**/*.php',
  '**/*.rb',
  '**/*.java',
  '**/*.kt',
  '**/*.cs',
  '**/*.sh',
  '**/*.bash',
  '**/*.zsh',
  '**/*.ps1',
  '**/*.ex',
  '**/*.exs',
  '**/*.swift',
  '**/*.tf',
  '**/*.tfvars',
  '**/Dockerfile*',
  '**/*.dockerfile',
  '**/.github/**/*.yml',
  '**/.github/**/*.yaml',
];

const CODE_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/vendor/**',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/.env*',
];

function getLanguage(filePath: string): SupportedLanguage {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  if (['.js', '.mjs', '.cjs', '.jsx'].includes(ext)) return 'javascript';
  if (['.ts', '.mts', '.cts', '.tsx'].includes(ext)) return 'typescript';
  if (ext === '.py') return 'python';
  if (ext === '.go') return 'go';
  if (ext === '.rs') return 'rust';
  if (ext === '.php') return 'php';
  if (ext === '.rb') return 'ruby';
  if (['.java', '.kt'].includes(ext)) return 'java';
  if (ext === '.cs') return 'csharp';
  if (['.sh', '.bash', '.zsh', '.ps1'].includes(ext)) return 'shell';
  if (['.ex', '.exs'].includes(ext)) return 'elixir';
  if (ext === '.swift') return 'swift';
  if (['.tf', '.tfvars'].includes(ext)) return 'terraform';
  if (base.includes('dockerfile')) return 'docker';
  if (['.yml', '.yaml'].includes(ext)) return 'yaml';
  return 'other';
}

interface PatternMatcher {
  regex: RegExp;
  language: SupportedLanguage;
  nameGroup: number;
  patternType: string;
}

const PATTERNS: PatternMatcher[] = [
  // JS/TS: process.env.VAR_NAME or process.env?.VAR_NAME
  {
    regex: /process\.env\??\.([A-Za-z_][A-Za-z0-9_]*)/g,
    language: 'javascript',
    nameGroup: 1,
    patternType: 'process.env.VAR',
  },
  // JS/TS: process.env['VAR_NAME'] or process.env["VAR_NAME"]
  {
    regex: /process\.env\s*\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g,
    language: 'javascript',
    nameGroup: 1,
    patternType: 'process.env["VAR"]',
  },
  // JS/TS: import.meta.env.VAR_NAME or import.meta.env?.VAR_NAME
  {
    regex: /import\.meta\.env\??\.([A-Za-z_][A-Za-z0-9_]*)/g,
    language: 'javascript',
    nameGroup: 1,
    patternType: 'import.meta.env.VAR',
  },
  // JS/TS: import.meta.env['VAR_NAME']
  {
    regex: /import\.meta\.env\s*\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g,
    language: 'javascript',
    nameGroup: 1,
    patternType: 'import.meta.env["VAR"]',
  },
  // Python: os.environ.get('VAR') or os.getenv('VAR') or environ['VAR'] or config('VAR')
  {
    regex: /(?:os\.)?(?:environ(?:\.get)?|getenv|config)\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    language: 'python',
    nameGroup: 1,
    patternType: 'os.getenv("VAR")',
  },
  {
    regex: /(?:os\.)?environ\s*\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    language: 'python',
    nameGroup: 1,
    patternType: 'os.environ["VAR"]',
  },
  // Go: os.Getenv("VAR") or os.LookupEnv("VAR")
  {
    regex: /os\.(?:Getenv|LookupEnv)\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    language: 'go',
    nameGroup: 1,
    patternType: 'os.Getenv("VAR")',
  },
  // Rust: env::var("VAR") or std::env::var("VAR") or dotenv!("VAR") or env!("VAR")
  {
    regex: /(?:std::)?env::var\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    language: 'rust',
    nameGroup: 1,
    patternType: 'env::var("VAR")',
  },
  {
    regex: /(?:dotenv|env)!\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    language: 'rust',
    nameGroup: 1,
    patternType: 'env!("VAR")',
  },
  // PHP: $_ENV['VAR'] or $_SERVER['VAR'] or getenv('VAR') or env('VAR')
  {
    regex: /\$(?:_ENV|_SERVER)\s*\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    language: 'php',
    nameGroup: 1,
    patternType: '$_ENV["VAR"]',
  },
  {
    regex: /(?:getenv|env)\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\)/g,
    language: 'php',
    nameGroup: 1,
    patternType: 'getenv("VAR")',
  },
  // Ruby: ENV['VAR'] or ENV.fetch('VAR')
  {
    regex: /ENV\s*\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    language: 'ruby',
    nameGroup: 1,
    patternType: 'ENV["VAR"]',
  },
  {
    regex: /ENV\.fetch\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    language: 'ruby',
    nameGroup: 1,
    patternType: 'ENV.fetch("VAR")',
  },
  // Java: System.getenv("VAR")
  {
    regex: /System\.getenv\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    language: 'java',
    nameGroup: 1,
    patternType: 'System.getenv("VAR")',
  },
  // C#: Environment.GetEnvironmentVariable("VAR")
  {
    regex: /Environment\.GetEnvironmentVariable\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    language: 'csharp',
    nameGroup: 1,
    patternType: 'Environment.GetEnvironmentVariable("VAR")',
  },
  // Elixir: System.get_env("VAR") or System.fetch_env("VAR") or System.fetch_env!("VAR")
  {
    regex: /System\.(?:get_env|fetch_env!?)\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    language: 'elixir',
    nameGroup: 1,
    patternType: 'System.get_env("VAR")',
  },
  // Swift: ProcessInfo.processInfo.environment["VAR"]
  {
    regex: /ProcessInfo\.processInfo\.environment\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
    language: 'swift',
    nameGroup: 1,
    patternType: 'ProcessInfo.processInfo.environment["VAR"]',
  },
  // Terraform: var.VAR_NAME or variable "VAR_NAME"
  {
    regex: /(?:var\.([A-Za-z_][A-Za-z0-9_]*)|variable\s+"([A-Za-z_][A-Za-z0-9_]*)")/g,
    language: 'terraform',
    nameGroup: 1,
    patternType: 'var.VAR',
  },
  // Dockerfile: ENV VAR_NAME=value or ENV VAR_NAME value or ARG VAR_NAME
  {
    regex: /^\s*(?:ENV|ARG)\s+([A-Za-z_][A-Za-z0-9_]*)(?:=|\s)/gm,
    language: 'docker',
    nameGroup: 1,
    patternType: 'ENV/ARG VAR',
  },
  // GitHub Actions: ${{ env.VAR }} or ${{ secrets.VAR }}
  {
    regex: /\$\{\{\s*(?:env|secrets)\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
    language: 'yaml',
    nameGroup: 1,
    patternType: '${{ env.VAR }}',
  },
];

// Special pattern for JS/TS destructuring: const { FOO, BAR } = process.env
const JS_DESTRUCTURE_REGEX = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:process\.env|import\.meta\.env)/g;

export async function findCodeFiles(
  cwd: string,
  customPatterns?: string[],
  customIgnore?: string[]
): Promise<string[]> {
  const patterns = customPatterns && customPatterns.length > 0 ? customPatterns : CODE_EXTENSIONS;
  const ignore = customIgnore && customIgnore.length > 0 ? customIgnore : CODE_IGNORE;

  const files = await fg(patterns, {
    cwd,
    ignore,
    dot: true,
    absolute: true,
    onlyFiles: true,
  });

  return files;
}

export async function scanCodeFile(filePath: string): Promise<CodeEnvUsage[]> {
  const usages: CodeEnvUsage[] = [];
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const lang = getLanguage(filePath);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // Check destructuring in JS/TS
    if (['javascript', 'typescript'].includes(lang)) {
      let destructureMatch;
      JS_DESTRUCTURE_REGEX.lastIndex = 0;
      while ((destructureMatch = JS_DESTRUCTURE_REGEX.exec(lineText)) !== null) {
        const rawVars = destructureMatch[1];
        const varNames = rawVars
          .split(',')
          .map((v) => v.trim().split(':')[0].trim().split('=')[0].trim())
          .filter((v) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v));

        for (const varName of varNames) {
          usages.push({
            name: varName,
            file: filePath,
            line: lineNum,
            column: destructureMatch.index + 1,
            codeSnippet: lineText.trim(),
            accessPattern: 'destructuring from process.env',
            language: lang,
            isBooleanCheck: false,
            isNumberCoercion: false,
          });
        }
      }
    }

    // Check all standard regex patterns
    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(lineText)) !== null) {
        const varName = match[pattern.nameGroup] || match[2];
        if (!varName) continue;

        // Skip internal/standard non-env matches (like NODE_ENV is fine, but filter out methods/properties)
        if (['prototype', 'length', 'name', 'constructor', 'default', 'toString'].includes(varName)) continue;

        // Check if there is a potential Boolean type trap (e.g. if (process.env.VAR) or !process.env.VAR or Boolean(process.env.VAR))
        const isBoolTrap =
          (lineText.includes(`if (${match[0]}`) ||
            lineText.includes(`!${match[0]}`) ||
            lineText.includes(`Boolean(${match[0]})`) ||
            lineText.includes(`${match[0]} ?`)) &&
          !lineText.includes('=== "true"') &&
          !lineText.includes("=== 'true'") &&
          !lineText.includes('=== "1"') &&
          !lineText.includes("=== '1'");

        // Check if coerced to number
        const isNumCoercion =
          lineText.includes(`Number(${match[0]})`) ||
          lineText.includes(`parseInt(${match[0]}`) ||
          lineText.includes(`+${match[0]}`);

        usages.push({
          name: varName,
          file: filePath,
          line: lineNum,
          column: match.index + 1,
          codeSnippet: lineText.trim(),
          accessPattern: pattern.patternType,
          language: lang,
          isBooleanCheck: isBoolTrap,
          isNumberCoercion: isNumCoercion,
        });
      }
    }
  }

  return usages;
}

export async function scanAllCodeFiles(
  cwd: string,
  customPatterns?: string[],
  customIgnore?: string[]
): Promise<{ files: string[]; usages: CodeEnvUsage[] }> {
  const files = await findCodeFiles(cwd, customPatterns, customIgnore);
  const usages: CodeEnvUsage[] = [];

  for (const file of files) {
    const fileUsages = await scanCodeFile(file);
    usages.push(...fileUsages);
  }

  return { files, usages };
}
