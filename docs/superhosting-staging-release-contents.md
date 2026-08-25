# Joan.bg: съдържание на SuperHosting staging release

**Цел:** когато cPanel достъпът е наличен, да се създаде преносим, проверим staging release. Той не е архив на данни и не съдържа secrets.

## Какво включва release пакетът

| Елемент | Причина | Проверка преди upload |
|---|---|---|
| `dist/` | Built client assets, Express server bundle и SSR bundle | Има `dist/index.js`, `dist/public/` и `dist/server-ssr/entry-server.js` |
| `package.json` и `pnpm-lock.yaml` | Детерминирани runtime dependencies | Lockfile съвпада с release commit |
| `drizzle/` | Schema/migration history за staging database | Няма dump с customer data вътре |
| `scripts/superhosting-preflight.mjs` | Runtime preflight след upload | Изпълнява се без secrets и без странични ефекти |
| `docs/superpro-cpanel-readiness.md` | Решение за Node и go/no-go checklist | Налична е актуална версия |
| `release-manifest.json` | Commit SHA, build timestamp, hashes и owner | Няма credentials, лични данни или DB URL |

## Какво изрично не включваме

`node_modules/`, `.env`, SSH ключове, OAuth/Forge keys, SQL dump-ове, customer exports, медийни архиви и cPanel backup архиви не влизат в source release. Те се съхраняват и прехвърлят отделно през защитен канал, само за staging и после за финалния production cutover.

## Staging upload ред

1. Създава се отделна application root директория и временен subdomain; не се използва `public_html` като app root.
2. Качва се release пакетът и се проверяват hashes от `release-manifest.json`.
3. В cPanel се настройва Node.js App startup entrypoint само за staging.
4. Създават се отделни staging environment variables и staging MySQL credentials извън source bundle.
5. Изпълнява се `node scripts/superhosting-preflight.mjs`, след което се проверяват app/error logs.
6. Данни и медии се възстановяват само след потвърден runtime старт.

## Rollback правило

Staging проблем никога не засяга `joan.bg`. При production cutover DNS се променя едва след подписан staging `PASS`; rollback означава връщане към предишния DNS target и запазване на final SQL/media backup, а не повторно качване на файлове на сляпо.
