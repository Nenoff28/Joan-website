# Development Workflow (Windows, локално)

## Изисквания (инсталирани на 2026-11-17)

- Node.js 22.23.5 (`C:\Program Files\nodejs`)
- pnpm 10.4.1 чрез `corepack pnpm …` (`corepack enable` изисква admin права, затова не е изпълнен)
- MySQL 8.4.9 (`C:\Program Files\MySQL\MySQL Server 8.4`), данни в `%USERPROFILE%\joan-mysql`
- Git — локално repository, branch `dev`, **без commit-и и без remote**

Ако `node` не е в PATH на Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"` (или рестарт на терминала).

## Стартиране

1. MySQL (ако не работи):
   ```bash
   "/c/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe" --defaults-file="$USERPROFILE/joan-mysql/my.ini" --console
   ```
2. Dev сървър (Express + Vite HMR + SSR):
   ```bash
   NODE_ENV=development PORT=3000 node node_modules/tsx/dist/cli.mjs watch server/index.ts
   ```
   `pnpm dev` **не работи на Windows** — скриптът ползва POSIX синтаксис `NODE_ENV=… tsx`, а pnpm изпълнява скриптовете през `cmd.exe`. Горната команда е еквивалентна (пуснете я в Git Bash).
3. Отворете **http://localhost:3000/** (ако портът е зает, сървърът избира следващия свободен и го пише в конзолата).

`.env` (в `.gitignore`) съдържа само локални стойности; Manus/Forge ключовете са нарочно празни.

## База данни

```bash
corepack pnpm exec drizzle-kit migrate   # прилага нови миграции към DATABASE_URL от .env
```

Нова миграция: промяна в `drizzle/schema.ts` → `corepack pnpm exec drizzle-kit generate` → преглед на SQL → `migrate` локално. Никога срещу production без отделно одобрение. Виж `DATABASE.md`.

## Проверки

```bash
corepack pnpm check   # tsc --noEmit
corepack pnpm test    # vitest run
```

Браузър проверки (Playwright, инсталиран 2026-11-17):

```bash
playwright-cli open http://localhost:3000/products   # интерактивно; --mobile за мобилен изглед
corepack pnpm exec playwright --version               # @playwright/test 1.65.1 + Chromium
```

Още няма `playwright.config.ts` и E2E тестове в проекта.

Резултат на 2026-11-17: `check` — 0 грешки; `test` — 366 минават, 6 падат (известни, виж `KNOWN_ISSUES.md`).

Build (`pnpm build`) също ползва POSIX env синтаксис; изпълнявайте го в Git Bash с `NODE_ENV=production` пред всяка стъпка или чрез `pnpm --config.script-shell=bash`.

## Review процес

Request → inspect → plan → локална промяна → `check` + `test` + браузър (desktop + mobile) → преглед от потребителя → изрично одобрение → commit/push. Без deploy без отделно одобрение.
