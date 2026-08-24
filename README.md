# 🧟‍♂️ ZombieConfig

> **Zero-Config, Multi-Language Zombie Environment & Config Variable Hunter for Developers and CI/CD Pipelines.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**GhostConfig** audits your codebase to detect dead (zombie) config variables, missing `.env.example` keys, dangerous JavaScript type traps (e.g. `ENABLE_FEATURE="false"` evaluated as truthy), and committed secret leaks across **JavaScript, TypeScript, Python, Go, Rust, PHP, Ruby, Java, C#, Docker, and GitHub Actions**.

---

## ⚡ Key Features

* 🧟‍♂️ **Zombie Variable Detection:** Finds variables defined in `.env`, `.env.local`, `docker-compose.yml`, or K8s configs that are **never referenced in code**.
* 🚨 **Missing & Undocumented Keys:** Flags environment variables referenced in your code that are absent from `.env.example` or active `.env`.
* ⚠️ **Boolean & Type Trap Hazards:** Catches logic traps like `if (process.env.DEBUG)` when `.env` contains `"false"` (which evaluates to truthy in JS!).
* 🔓 **Secret Leak Scanner:** High-entropy and pattern scanner preventing accidental credential leaks (AWS, OpenAI, Stripe, JWT, Private Keys) in `.env.example` templates.
* 🛠️ **Auto-Fixers:**
  - `ghostconfig fix --sync-example`: Automatically syncs `.env.example` with safe placeholder comments.
  - `ghostconfig fix --prune`: Safely comments out or removes zombie keys from `.env`.
* 📐 **Schema Generator:**
  - `ghostconfig generate --schema zod`: Generates type-safe Zod validation schemas.
  - `ghostconfig generate --schema ts`: Generates TypeScript `env.d.ts` definitions.
* 🤖 **CI/CD Integration:** Supports `--ci`, `--strict`, and `--format json` with proper exit codes for GitHub Actions, GitLab CI, and Docker builds.

---

## 🚀 Quick Start

### Run directly with `npx`:
```bash
npx ghostconfig scan
```

### Install globally:
```bash
npm install -g ghostconfig
ghostconfig scan
```

---

## 💻 CLI Usage

### 1. Audit / Scan
```bash
# Scan current project
ghostconfig scan

# Scan a specific directory
ghostconfig scan -d ./my-project

# Output machine-readable JSON for CI/CD
ghostconfig scan --format json

# Enforce strict CI check (fails on any zombie or missing var)
ghostconfig scan --ci --strict --min-score 85
```

### 2. Auto-Fix Issues
```bash
# Automatically update .env.example with missing variables
ghostconfig fix --sync-example

# Safely archive zombie variables in .env (comments them out)
ghostconfig fix --prune

# Run all automated fixes
ghostconfig fix --all
```

### 3. Generate Type-Safe Schemas
```bash
# Generate Zod schema
ghostconfig generate --schema zod --out src/env.ts

# Generate TypeScript declarations
ghostconfig generate --schema ts --out types/env.d.ts
```

---

## 🌐 Supported Languages & Frameworks

| Language / Tool | Detected Patterns |
|-----------------|-------------------|
| **JavaScript / TypeScript** | `process.env.VAR`, `process.env['VAR']`, `import.meta.env.VAR`, Destructuring `const { VAR } = process.env` |
| **Python** | `os.getenv("VAR")`, `os.environ["VAR"]`, `os.environ.get("VAR")`, `config("VAR")` |
| **Go** | `os.Getenv("VAR")`, `os.LookupEnv("VAR")` |
| **Rust** | `std::env::var("VAR")`, `env::var("VAR")`, `dotenv!("VAR")`, `env!("VAR")` |
| **PHP** | `$_ENV['VAR']`, `$_SERVER['VAR']`, `getenv('VAR')`, `env('VAR')` |
| **Ruby** | `ENV['VAR']`, `ENV.fetch('VAR')` |
| **Java / Kotlin** | `System.getenv("VAR")` |
| **C# / .NET** | `Environment.GetEnvironmentVariable("VAR")` |
| **Docker / Compose** | `docker-compose.yml`, `Dockerfile` `ENV`/`ARG` |
| **CI / CD** | GitHub Actions `${{ env.VAR }}`, `${{ secrets.VAR }}` |

---

## 📊 Sample Terminal Output

```
   ____  _               _    ____             __ _       
  / ___|| |__   ___  ___| |_ / ___|___  _ __  / _(_) __ _ 
 | |  _ | '_ \ / _ \/ __| __| |   / _ \| '_ \| |_| |/ _` |
 | |_| || | | | (_) \__ \ |_| |__| (_) | | | |  _| | (_| |
  \____||_| |_|\___/|___/\__|\____\___/|_| |_|_| |_|\__, |
                                                     |___/ 
  Zero-Config Zombie Env & Config Auditor v1.0.0

📊 AUDIT SUMMARY
   Health Score : ████████████░░░░░░░░ 60/100
   Code Files   : 14 scanned
   Env Files    : 2 scanned (.env, .env.example)
   Variables    : 18 defined | 22 references
   Audit Time   : 32ms

 ⚠️ TYPE TRAPS & LOGIC HAZARDS 

  ● ENABLE_FEATURE (boolean_string_trap)
    Env Config : false in .env:6
    Code Usage : "if (process.env.ENABLE_FEATURE)" in src/server.ts:12
    Hazard     : Variable is set to "false", but tested as truthy boolean. In JS, "false" string is truthy!
    Fix        : Use process.env.ENABLE_FEATURE === 'true' or validate with Zod.

🚨 MISSING / UNDOCUMENTED VARIABLES

  ● STRIPE_SECRET_KEY [Missing in .env.example]
    Suggested Default: your_stripe_secret_key_here
    Referenced In:
      - src/services/billing.ts:8 ("const key = process.env.STRIPE_SECRET_KEY")

🧟 ZOMBIE / GHOST VARIABLES (Defined in config, never used in code)

  ● OLD_LEGACY_TOKEN = "xyz_123" [Dead - Can be pruned]
    Found in: .env (line 14)
```

---

## 🛠️ Programmatic API

GhostConfig can also be used as a TypeScript library:

```typescript
import { runAudit, generateZodSchema } from 'ghostconfig';

const result = await runAudit({ cwd: './' });

console.log(`Health Score: ${result.healthScore}/100`);
console.log(`Zombie Variables: ${result.zombies.length}`);
console.log(`Missing Variables: ${result.missing.length}`);
```

---

## 🧪 Testing

```bash
npm run test
```

## 📄 License
MIT © Antigravity
