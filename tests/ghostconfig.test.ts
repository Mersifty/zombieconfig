import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  runAudit,
  loadConfig,
  formatMarkdownReport,
  formatJsonReport,
  formatTerminalReport,
  analyzeDuplicates,
  analyzeValues,
  analyzeDeprecations,
} from '../dist/index.js';
import { generateZodSchema, generateTypeScriptDeclaration } from '../dist/formatters/schema-gen.js';
import { syncExampleFile } from '../dist/fixers/example-syncer.js';

describe('GhostConfig Audit Engine v2.0', () => {
  const fixtureDir = path.resolve('tests/fixtures/sample-app');

  test('detects all zombie / ghost variables', async () => {
    const result = await runAudit({ cwd: fixtureDir });

    assert.ok(result.scannedEnvFiles.length >= 2, 'Should scan both .env and .env.example');
    assert.ok(result.healthScore >= 0 && result.healthScore <= 100);
    assert.ok(['A+', 'A', 'B', 'C', 'D', 'F'].includes(result.healthGrade));
  });

  test('detects missing variables in active .env and .env.example', async () => {
    const result = await runAudit({ cwd: fixtureDir });

    const missingNames = result.missing.map((m) => m.name);
    assert.ok(missingNames.includes('STRIPE_PUBLIC_KEY'), 'Should detect STRIPE_PUBLIC_KEY missing');
    assert.ok(missingNames.includes('AWS_REGION'), 'Should detect AWS_REGION missing');
  });

  test('detects boolean type traps ("false" truthy bug in JS)', async () => {
    const result = await runAudit({ cwd: fixtureDir });

    const trap = result.typeTraps.find((t) => t.name === 'ENABLE_BETA_FEATURES');
    assert.ok(trap, 'Should detect ENABLE_BETA_FEATURES boolean trap');
    assert.strictEqual(trap.hazard, 'boolean_string_trap');
  });

  test('detects OpenAI secret leak in example and active env', async () => {
    const result = await runAudit({ cwd: fixtureDir });

    const leaks = result.secretLeaks.filter((s) => s.name === 'OPENAI_API_KEY');
    assert.ok(leaks.length > 0, 'Should detect OPENAI_API_KEY leak');
    assert.strictEqual(leaks[0].severity, 'critical');
  });

  test('generates type-safe Zod schema', async () => {
    const result = await runAudit({ cwd: fixtureDir });
    const schema = generateZodSchema(result);

    assert.ok(schema.includes('export const envSchema = z.object('));
    assert.ok(schema.includes('PORT: z.coerce.number()'));
    assert.ok(schema.includes('DATABASE_URL: z.string().url()'));
    assert.ok(schema.includes('ENABLE_BETA_FEATURES: z.enum('));
  });

  test('generates TypeScript ambient declarations', async () => {
    const result = await runAudit({ cwd: fixtureDir });
    const tsDecl = generateTypeScriptDeclaration(result);

    assert.ok(tsDecl.includes('declare global'));
    assert.ok(tsDecl.includes('interface ProcessEnv'));
    assert.ok(tsDecl.includes('PORT?: string;'));
  });

  test('syncExampleFile creates/updates .env.example with missing variables', async () => {
    const tempExamplePath = path.resolve(fixtureDir, '.env.example.test');
    await fs.writeFile(tempExamplePath, 'EXISTING_VAR=123\n', 'utf-8');

    const result = await runAudit({ cwd: fixtureDir });
    const syncRes = await syncExampleFile(result, '.env.example.test');

    assert.ok(syncRes.addedKeys.length > 0, 'Should add missing keys to template');
    const content = await fs.readFile(tempExamplePath, 'utf-8');
    assert.ok(content.includes('STRIPE_PUBLIC_KEY='), 'Should contain STRIPE_PUBLIC_KEY');

    await fs.unlink(tempExamplePath);
  });

  // --- v2.0 Tests ---

  test('analyzes duplicate definitions and detects value conflicts', () => {
    const defs = [
      { name: 'PORT', value: '3000', file: '.env', line: 1, isExample: false, isCommentedOut: false, rawLine: 'PORT=3000' },
      { name: 'PORT', value: '8080', file: '.env.local', line: 1, isExample: false, isCommentedOut: false, rawLine: 'PORT=8080' },
      { name: 'API_KEY', value: '123', file: '.env', line: 2, isExample: false, isCommentedOut: false, rawLine: 'API_KEY=123' },
      { name: 'API_KEY', value: '123', file: '.env.local', line: 2, isExample: false, isCommentedOut: false, rawLine: 'API_KEY=123' },
    ];

    const duplicates = analyzeDuplicates(defs);
    assert.strictEqual(duplicates.length, 2);

    const portDup = duplicates.find((d) => d.name === 'PORT');
    assert.ok(portDup);
    assert.strictEqual(portDup.hasDifferentValues, true);

    const keyDup = duplicates.find((d) => d.name === 'API_KEY');
    assert.ok(keyDup);
    assert.strictEqual(keyDup.hasDifferentValues, false);
  });

  test('analyzes and validates env variable values (URL, Port, Email, Placeholders)', () => {
    const defs = [
      { name: 'DATABASE_URL', value: 'not_a_valid_url', file: '.env', line: 1, isExample: false, isCommentedOut: false, rawLine: 'DATABASE_URL=not_a_valid_url' },
      { name: 'APP_PORT', value: '99999', file: '.env', line: 2, isExample: false, isCommentedOut: false, rawLine: 'APP_PORT=99999' },
      { name: 'ADMIN_EMAIL', value: 'invalid_email_format', file: '.env', line: 3, isExample: false, isCommentedOut: false, rawLine: 'ADMIN_EMAIL=invalid_email_format' },
      { name: 'SECRET_API_KEY', value: '', file: '.env', line: 4, isExample: false, isCommentedOut: false, rawLine: 'SECRET_API_KEY=' },
    ];

    const issues = analyzeValues(defs);
    assert.ok(issues.some((i) => i.name === 'DATABASE_URL' && i.rule === 'invalid_url'));
    assert.ok(issues.some((i) => i.name === 'APP_PORT' && i.rule === 'invalid_port'));
    assert.ok(issues.some((i) => i.name === 'ADMIN_EMAIL' && i.rule === 'invalid_email'));
    assert.ok(issues.some((i) => i.name === 'SECRET_API_KEY' && i.rule === 'empty_required'));
  });

  test('detects deprecated env naming patterns (CRA, legacy DB, AWS)', () => {
    const defs = [
      { name: 'REACT_APP_API_URL', value: 'https://api.com', file: '.env', line: 1, isExample: false, isCommentedOut: false, rawLine: 'REACT_APP_API_URL=...' },
      { name: 'MONGO_URI', value: 'mongodb://localhost', file: '.env', line: 2, isExample: false, isCommentedOut: false, rawLine: 'MONGO_URI=...' },
      { name: 'AWS_ACCESS_KEY', value: 'AKIA1234567890123456', file: '.env', line: 3, isExample: false, isCommentedOut: false, rawLine: 'AWS_ACCESS_KEY=...' },
    ];

    const deprecations = analyzeDeprecations(defs);
    assert.strictEqual(deprecations.length, 3);
    assert.ok(deprecations.some((d) => d.name === 'REACT_APP_API_URL' && d.replacement === 'VITE_'));
    assert.ok(deprecations.some((d) => d.name === 'MONGO_URI'));
    assert.ok(deprecations.some((d) => d.name === 'AWS_ACCESS_KEY' && d.replacement === 'AWS_ACCESS_KEY_ID'));
  });

  test('formats Markdown reports correctly with tables and badges', async () => {
    const result = await runAudit({ cwd: fixtureDir });
    const md = formatMarkdownReport(result);

    assert.ok(md.includes('# 🧟 ZombieConfig Audit Report'));
    assert.ok(md.includes('## 📊 Summary'));
    assert.ok(md.includes('## 🔍 Issues Overview'));
    assert.ok(md.includes('| Metric | Value |'));
  });

  test('formats JSON reports with all v2.0 fields', async () => {
    const result = await runAudit({ cwd: fixtureDir });
    const jsonStr = formatJsonReport(result);
    const parsed = JSON.parse(jsonStr);

    assert.ok(parsed.summary);
    assert.ok(parsed.summary.healthGrade);
    assert.strictEqual(typeof parsed.summary.healthScore, 'number');
    assert.ok(Array.isArray(parsed.duplicates));
    assert.ok(Array.isArray(parsed.valueIssues));
    assert.ok(Array.isArray(parsed.deprecations));
  });

  test('formats Terminal UI report without throwing', async () => {
    const result = await runAudit({ cwd: fixtureDir });
    const report = formatTerminalReport(result);

    assert.ok(report.includes('AUDIT SUMMARY'));
    assert.ok(report.includes('Health Score'));
  });

  test('loads project config properly with defaults', async () => {
    const config = await loadConfig(fixtureDir);
    assert.strictEqual(typeof config.minScore, 'number');
    assert.ok(Array.isArray(config.ignore));
  });
});
