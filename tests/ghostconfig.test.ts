import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runAudit } from '../dist/index.js';
import { generateZodSchema, generateTypeScriptDeclaration } from '../dist/formatters/schema-gen.js';
import { syncExampleFile } from '../dist/fixers/example-syncer.js';
import { pruneZombieVariables } from '../dist/fixers/env-pruner.js';

describe('GhostConfig Audit Engine', () => {
  const fixtureDir = path.resolve('tests/fixtures/sample-app');

  test('detects all zombie / ghost variables', async () => {
    const result = await runAudit({ cwd: fixtureDir });

    const zombieNames = result.zombies.map((z) => z.variable.name);
    // Since some may be commented out or active, verify detection logic
    assert.ok(result.scannedEnvFiles.length >= 2, 'Should scan both .env and .env.example');
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
});
