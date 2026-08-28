# 🧟‍♂️ ZombieConfig v2.0

<p align="center">
  <strong>Zero-Config, Blazing-Fast Zombie Environment & Config Variable Hunter</strong><br>
  <em>Audit dead env vars, missing .env.example keys, duplicate conflicts, value traps & secret leaks across any codebase in milliseconds.</em>
</p>

<p align="center">
  <a href="https://github.com/Mersifty/zombieconfig/actions"><img src="https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square" alt="CI Status" /></a>
  <a href="https://www.npmjs.com/package/zombieconfig"><img src="https://img.shields.io/badge/version-2.0.0-cb3837.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="Node.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
</p>

---

## 🧐 Why ZombieConfig?

In fast-moving teams and growing codebases, `.env` files inevitably turn into a **graveyard of broken, forgotten configurations**:

1. **🧟 Zombie / Ghost Variables:** Features get removed from code, but their corresponding API keys and config values linger in `.env` and `docker-compose.yml` for months because nobody dares to touch them.
2. **🚨 Broken Onboarding (Missing Keys):** A developer adds `process.env.NEW_SECRET` in code but forgets to update `.env.example`. New teammates clone the repo and spend hours debugging unexpected startup crashes.
3. **🔁 Conflicting Duplicate Definitions:** `PORT=3000` in `.env` vs `PORT=8080` in `.env.local` causing silent, hard-to-track runtime behavior differences.
4. **📋 Malformed & Invalid Values:** `DATABASE_URL` missing protocol, invalid port numbers (`99999`), or forgotten placeholder strings like `your_key_here` running in staging/prod.
5. **⚠️ The Infamous JavaScript "Type Trap":** Setting `ENABLE_BETA="false"` in `.env` causes `if (process.env.ENABLE_BETA)` to evaluate to **`true`** because non-empty strings are truthy in JS!
6. **🔓 Leaked Secrets in Public Templates:** Real OpenAI, AWS, Supabase, SendGrid, or Stripe tokens mistakenly committed into `.env.example` or public Git repositories.

**ZombieConfig** solves all of these with **zero configuration**, instant diagnostics, and one-command auto-fixers.

---

## ⚡ What's New in v2.0?

* 🩺 **`zombieconfig doctor`**: Complete diagnostic health report with health grades (`A+` to `F`) and prescriptions.
* 🔍 **`zombieconfig diff <fileA> <fileB>`**: Side-by-side colorized diff comparing environment variables across stages (e.g. `.env` vs `.env.production`).
* ⚙️ **`.zombieconfigrc.json` Support**: Project-level configuration file to customize ignore lists, rules, and scoring thresholds.
* 👁️ **Watch Mode (`--watch`)**: Real-time continuous file monitoring with instant re-scan on file save.
* 📝 **Markdown Reporter (`--format markdown`)**: Generate GitHub PR-ready Markdown tables and badges for automated CI/CD comments.
* 🔁 **Duplicate & Conflict Analyzer**: Pinpoints variables defined across multiple `.env` files with conflicting values.
* 📋 **Value Validation Engine**: Validates URLs, port ranges (0-65535), email formats, and catches suspicious placeholder strings.
* 📦 **Deprecation Analyzer**: Detects legacy patterns (`REACT_APP_*` → `VITE_*`, `MONGO_URI` → `MONGODB_URI`, Heroku addons, etc.).
* 🌐 **Expanded Language Support**: Added Elixir (`System.get_env`), Swift (`ProcessInfo`), Terraform (`var.*`), and Dockerfile (`ENV`/`ARG`).
* 🛡️ **Modern Secret Patterns**: Detects leaked Supabase, SendGrid, Vercel, Firebase, MongoDB connection strings, and exposed DB passwords.

---

## 🚀 Quick Start

Run instantly with **`npx`** (no installation needed):

```bash
npx zombieconfig
```

Or install globally:

```bash
npm install -g zombieconfig
zombieconfig
```

---

## 💻 CLI Commands & Options

### 1. Audit & Scan
```bash
# Scan current repository (interactive colored terminal report)
zombieconfig scan

# Continuous real-time watch mode
zombieconfig scan --watch

# Output GitHub PR-ready Markdown
zombieconfig scan --format markdown

# Output machine-readable JSON for CI/CD pipelines
zombieconfig scan --format json

# Enforce strict CI check (fails if health score < 85 or critical issues exist)
zombieconfig scan --ci --strict --min-score 85
```

### 2. Compare Environments (`diff`)
```bash
# Compare staging vs production environment configs
zombieconfig diff .env.staging .env.production

# Compare local env with template
zombieconfig diff .env .env.example
```

### 3. Project Health Doctor (`doctor`)
```bash
# Perform deep diagnostic health check
zombieconfig doctor
```

### 4. Initialize Configuration (`init`)
```bash
# Create .zombieconfigrc.json and generate initial .env.example
zombieconfig init

# Create only the configuration file
zombieconfig init --config-only
```

### 5. Auto-Fix
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

### 6. Generate Type-Safe Schemas
```bash
# Generate a type-safe Zod validation schema
zombieconfig generate --schema zod --out src/env.ts

# Generate TypeScript ambient declarations
zombieconfig generate --schema ts --out types/env.d.ts
```

---

## ⚙️ Configuration (`.zombieconfigrc.json`)

You can customize ZombieConfig by adding a `.zombieconfigrc.json` file to your project root (or inside `package.json` under `"zombieconfig"`):

```json
{
  "minScore": 85,
  "ignore": ["NODE_ENV", "CI", "DEBUG"],
  "include": ["src/**", "lib/**"],
  "exclude": ["**/vendor/**", "**/node_modules/**"],
  "rules": {
    "noSecrets": true,
    "requireExample": true,
    "noDuplicates": true,
    "validateValues": true,
    "checkDeprecations": true
  }
}
```

---

## 🌐 Supported Languages & Patterns

| Language / Framework | Detected Access Patterns |
|----------------------|--------------------------|
| **JavaScript / TypeScript** | `process.env.VAR`, `process.env['VAR']`, `import.meta.env.VAR`, `const { VAR } = process.env` |
| **Python** | `os.getenv("VAR")`, `os.environ["VAR"]`, `os.environ.get("VAR")`, `config("VAR")` |
| **Go** | `os.Getenv("VAR")`, `os.LookupEnv("VAR")` |
| **Rust** | `std::env::var("VAR")`, `env::var("VAR")`, `dotenv!("VAR")`, `env!("VAR")` |
| **PHP** | `$_ENV['VAR']`, `$_SERVER['VAR']`, `getenv('VAR')`, `env('VAR')` |
| **Ruby** | `ENV['VAR']`, `ENV.fetch('VAR')` |
| **Java / Kotlin** | `System.getenv("VAR")` |
| **C# / .NET** | `Environment.GetEnvironmentVariable("VAR")` |
| **Elixir** | `System.get_env("VAR")`, `System.fetch_env("VAR")`, `System.fetch_env!("VAR")` |
| **Swift** | `ProcessInfo.processInfo.environment["VAR"]` |
| **Terraform** | `var.VAR_NAME`, `variable "VAR_NAME"` |
| **Docker** | `docker-compose.yml`, `compose.yaml`, `Dockerfile` `ENV`/`ARG` |
| **GitHub Actions** | `${{ env.VAR }}`, `${{ secrets.VAR }}` |

---

## 🤖 GitHub Actions CI Workflow

Add this to `.github/workflows/env-check.yml` to automatically fail pull requests with broken configs or leaked secrets:

```yaml
name: Environment Health Check

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
        run: npx zombieconfig scan --ci --strict --min-score 85
```

---

## 📊 Comparison with Other Tools

| Feature | ZombieConfig | dotenv-linter | t3-env / Zod | GitGuardian / TruffleHog |
|---------|:------------:|:-------------:|:------------:|:------------------------:|
| **Zero-Config Static CLI** | ✅ **Yes** | ✅ Yes | ❌ Requires Code Refactor | ✅ Yes |
| **Zombie / Dead Variable Detection** | ✅ **Yes** | ❌ No | ❌ No | ❌ No |
| **Missing .env.example Sync** | ✅ **Yes** | ❌ No | ❌ No | ❌ No |
| **Multi-Language AST Scanner** | ✅ **12+ Languages** | ❌ Env only | ❌ JS/TS only | ❌ Secrets only |
| **Side-by-Side Env Diff** | ✅ **Yes** | ❌ No | ❌ No | ❌ No |
| **Type Trap & Logic Hazard Alert** | ✅ **Yes** | ❌ No | ❌ Partial (Runtime) | ❌ No |
| **Auto-Generate Zod & TS Schemas** | ✅ **Yes** | ❌ No | ❌ Manual | ❌ No |
| **Interactive Terminal UI & Doctor** | ✅ **Yes** | ❌ Basic | ❌ None | ❌ Dashboard only |

---

## 🛠️ Programmatic API

You can use ZombieConfig as a TypeScript library in your custom build scripts or developer tooling:

```typescript
import { runAudit, generateZodSchema, analyzeDuplicates } from 'zombieconfig';

const result = await runAudit({ cwd: process.cwd() });

console.log(`Health Grade: ${result.healthGrade} (${result.healthScore}/100)`);
console.log(`Zombie Variables: ${result.zombies.length}`);
console.log(`Missing Variables: ${result.missing.length}`);
console.log(`Conflicting Duplicates: ${result.duplicates.length}`);
```

---

## 🧪 Running Tests

```bash
npm run test
```

---

## 📄 License

MIT © [Mersifty](https://github.com/Mersifty)
