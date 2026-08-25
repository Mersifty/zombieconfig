# 🧟‍♂️ ZombieConfig

<p align="center">
  <strong>Zero-Config, Blazing-Fast Zombie Environment & Config Variable Hunter</strong><br>
  <em>Audit dead env vars, missing .env.example keys, type traps & secret leaks across any codebase in milliseconds.</em>
</p>

<p align="center">
  <a href="https://github.com/Mersifty/zombieconfig/actions"><img src="https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square" alt="CI Status" /></a>
  <a href="https://www.npmjs.com/package/zombieconfig"><img src="https://img.shields.io/npm/v/zombieconfig.svg?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="Node.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
</p>

---

## 🧐 Why ZombieConfig?

In fast-moving teams, `.env` files inevitably become a **graveyard of forgotten configurations**:

1. **🧟 Zombie / Ghost Variables:** Features get deleted from code, but their corresponding API keys and config values remain in `.env` and `docker-compose.yml` for months because nobody dares to touch them.
2. **🚨 Broken Onboarding (Missing Keys):** A developer adds `process.env.NEW_SECRET` in code but forgets to update `.env.example`. New teammates clone the repo and spend hours debugging unexpected startup crashes.
3. **⚠️ The Infamous JavaScript "Type Trap":** Setting `ENABLE_BETA="false"` in `.env` causes `if (process.env.ENABLE_BETA)` to evaluate to **`true`** because in JavaScript, non-empty strings are always truthy!
4. **🔓 Leaked Secrets in Templates:** Real OpenAI, AWS, or Stripe tokens mistakenly committed into `.env.example` or public repositories.

**ZombieConfig** solves all of these with **zero configuration** and instant auto-fixers.

---

## ⚡ Key Highlights

* 🔍 **Multi-Language AST Scanner:** Scans JavaScript, TypeScript, Python, Go, Rust, PHP, Ruby, Java, C#, Dockerfile, and GitHub Actions YAML.
* 🧟‍♂️ **Ghost Detection:** Pinpoints variables defined in config that are never read anywhere in code.
* 🚨 **Missing Key Auditing:** Identifies undocumented environment variables and suggests safe default values.
* ⚠️ **Logic & Type Trap Warnings:** Catches boolean string hazards (`"false"` truthy bug) and numeric NaN pitfalls.
* 🔓 **Secret Leak Prevention:** High-entropy and pattern detection for leaked tokens (AWS, OpenAI, Anthropic, Stripe, JWT, Private Keys).
* 🛠️ **One-Command Auto-Fixers:**
  - `zombieconfig fix --sync-example`: Automatically creates or updates `.env.example`.
  - `zombieconfig fix --prune`: Safely archives/comments out dead zombie keys from `.env`.
* 📐 **Schema Generator:** Auto-generates type-safe **Zod** schemas or TypeScript `env.d.ts` declarations directly from your project's variables.
* 🤖 **CI/CD Ready:** Exit-code support and `--format json` for automated pull request checks in GitHub Actions and GitLab CI.

---

## 🚀 Quick Start

Run instantly with **`npx`** (no installation required):

```bash
npx zombieconfig
```

Or install globally via npm:

```bash
npm install -g zombieconfig
zombieconfig
```

---

## 💻 CLI Commands & Options

### 1. Audit & Scan
```bash
# Scan current repository
zombieconfig scan

# Scan a specific directory
zombieconfig scan -d ./packages/backend

# Output machine-readable JSON for CI/CD pipelines
zombieconfig scan --format json

# Enforce strict CI check (fails if health score < 85 or critical issues exist)
zombieconfig scan --ci --strict --min-score 85
```

### 2. Auto-Fix
```bash
# Automatically update .env.example with missing variables
zombieconfig fix --sync-example

# Safely archive zombie variables in .env (comments them out)
zombieconfig fix --prune

# Permanently delete dead zombie lines instead of commenting out
zombieconfig fix --prune --remove

# Perform all fixes at once
zombieconfig fix --all
```

### 3. Generate Type-Safe Schemas
```bash
# Generate a type-safe Zod validation schema
zombieconfig generate --schema zod --out src/env.ts

# Generate TypeScript ambient declarations
zombieconfig generate --schema ts --out types/env.d.ts
```

---

## 🌐 Supported Languages & Patterns

| Language / Framework | Detected Patterns |
|----------------------|-------------------|
| **JavaScript / TypeScript** | `process.env.VAR`, `process.env['VAR']`, `import.meta.env.VAR`, `const { VAR } = process.env` |
| **Python** | `os.getenv("VAR")`, `os.environ["VAR"]`, `os.environ.get("VAR")`, `config("VAR")` |
| **Go** | `os.Getenv("VAR")`, `os.LookupEnv("VAR")` |
| **Rust** | `std::env::var("VAR")`, `env::var("VAR")`, `dotenv!("VAR")`, `env!("VAR")` |
| **PHP** | `$_ENV['VAR']`, `$_SERVER['VAR']`, `getenv('VAR')`, `env('VAR')` |
| **Ruby** | `ENV['VAR']`, `ENV.fetch('VAR')` |
| **Java / Kotlin** | `System.getenv("VAR")` |
| **C# / .NET** | `Environment.GetEnvironmentVariable("VAR")` |
| **Docker** | `docker-compose.yml`, `compose.yaml`, `Dockerfile` `ENV`/`ARG` |
| **GitHub Actions** | `${{ env.VAR }}`, `${{ secrets.VAR }}` |

---

## 🤖 GitHub Actions CI Workflow

Add this to `.github/workflows/env-check.yml` to prevent broken `.env.example` files in pull requests:

```yaml
name: Environment Health Audit

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  env-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Audit Environment with ZombieConfig
        run: npx zombieconfig scan --ci --strict --min-score 80
```

---

## 🛠️ Programmatic API

You can also use ZombieConfig as a TypeScript library in your build scripts:

```typescript
import { runAudit, generateZodSchema } from 'zombieconfig';

const result = await runAudit({ cwd: process.cwd() });

console.log(`Project Health Score: ${result.healthScore}/100`);
console.log(`Zombie Variables: ${result.zombies.length}`);
console.log(`Missing Variables: ${result.missing.length}`);
console.log(`Type Traps Found: ${result.typeTraps.length}`);
```

---

## 🧪 Running Tests

```bash
npm run test
```

---

## 📄 License

MIT © [Mersifty](https://github.com/Mersifty)
