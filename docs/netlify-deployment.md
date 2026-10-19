# Netlify deployment на Joan.bg

Този документ описва подготвения deployment без промяна на продуктите, категориите, цените, SKU, базата или managed media references.

## Какво беше поправено

Първоначалната грешка `The deploy directory site does not exist` / `No build steps found` идваше от липсваща `netlify.toml`. Проектът не е static-only Vite приложение: текущият runtime комбинира React SSR, Express, tRPC API, authentication routes, storage proxy, sitemap и MySQL-compatible database. Затова само `publish = "dist"` би показал част от интерфейса, но би прекъснал заявките, админ панела, login flow-а и динамичните данни.

Добавени са:

- `netlify.toml` с `pnpm run build`, `dist/public`, `netlify/functions`, Node 22.13 и esbuild bundling.
- `netlify/functions/server.ts`, който използва същия Express app през `serverless-http`.
- reusable `createApp` / `createProductionApp` factory в `server/_core/index.ts`.
- общ production entrypoint в `server/index.ts`, за да не се поддържат два различни server contract-а.
- dynamic loading на dev-only Vite конфигурацията, така че Netlify Function да не зарежда Vite dev config при cold start.
- production dist root, базиран на `process.cwd()/dist`, което работи и в bundled function runtime.
- regression тест `server/netlifyDeployment.test.ts`.

## Какво остава динамично

Продуктите и останалото съдържание не са превръщани в примерни JSON файлове. Function използва същия `DATABASE_URL` и същия `catalogueService` / tRPC contract. Изображенията остават под съществуващите `/manus-storage/<key>` пътища и се обслужват от текущия storage proxy или от `LOCAL_MEDIA_ROOT` при portable deployment.

Read-only media manifest от текущата база отчете **8 361 уникални managed media файла**, **22 658 database media references** и **90 source-code references**. Представителните logo, category JPEG и hero MP4 ресурси върнаха HTTP 200 през текущия Express storage endpoint. Това не е доказателство, че Netlify ще има достъп до storage, докато нужните server-side environment variables не бъдат зададени.

## Netlify environment variables

В Netlify Project configuration → Environment variables трябва да се зададат стойности за средата, без да се commit-ват в repository:

- `DATABASE_URL` — достъп до същата MySQL-compatible база или към възстановената staging база.
- `JWT_SECRET` — secret за customer/admin session cookies.
- `CANONICAL_ORIGIN` — Netlify staging URL; при бъдещ cutover — официалният домейн.
- `SITE_NAME=ЖОАН`.
- `BUILT_IN_FORGE_API_URL` и `BUILT_IN_FORGE_API_KEY` — само ако се запазва Manus managed storage proxy.
- `LOCAL_MEDIA_ROOT` — алтернатива при portable local media export; задава се като абсолютен runtime path и не се commit-ва.
- `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME` — нужни само за запазване на текущия Manus admin OAuth flow.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — само ако Google login бъде активиран; callback-ът трябва да сочи към Netlify domain-а.
- `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` — само ако се запази analytics integration.
- `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` — само ако map компонентът се използва с Forge map provider.

Не използвайте публичния `VITE_` префикс за server-only secrets. `BUILT_IN_FORGE_API_KEY`, `DATABASE_URL` и `JWT_SECRET` трябва да останат server-side.

## Build настройки

```text
Build command: pnpm run build
Publish directory: dist/public
Functions directory: netlify/functions
Node version: 22.13.0
pnpm version: 10.4.1
```

`dist/server-ssr/**` е включен изрично във Function bundle-а, защото SSR entrypoint-ът се зарежда динамично. `dist/public/**` също е включен, за да може Express fallback-ът във Function да обслужва SSR template и assets при serverless execution.

## Важни Netlify ограничения

Netlify Functions са подходящи за SSR/API adapter-а, но не са напълно еквивалентни на persistent Node server при всяка операция. Официалната Netlify документация посочва 60 секунди синхронно изпълнение и 6 MB buffered request/response payload; binary uploads се base64-encode-ват и ефективният payload лимит за бинарни данни е приблизително 4.5 MB. Текущите admin upload процедури приемат base64 data URLs до 15 MB за продуктови/категорийни снимки и до 28 MB за brochure source PDF. Следователно upload-и над Netlify лимита трябва да се насочат през direct-to-object-storage flow или да останат на persistent Node deployment; не са фалшифицирани и не са тихо премахнати.

Текущите публични metadata, SSR, sitemap и database-backed catalogue routes са проверени през локално изпълнен Netlify-style handler. За production Netlify ще са нужни действителни DB, auth и storage environment variables.

## Реално изпълнени проверки

- `pnpm test`: **78 test files / 327 tests passed**.
- `pnpm exec tsc --noEmit --pretty false`: passed.
- `pnpm build`: passed; генерирани са `dist/public`, `dist/server-ssr` и `dist/index.js`.
- Netlify Function esbuild bundle: passed; handler bundle около 336 KB преди runtime dependencies.
- SSR Function smoke: началната страница HTTP 200 и representative asset HTTP 200.
- API Function smoke: `catalogue.metadata` HTTP 200.
- Sitemap Function smoke: `/sitemap.xml` HTTP 200.
- `git diff --check`: passed.
- Media readback: representative logo, category image и hero video HTTP 200.

Не е извършен реален Netlify deploy към потребителски Netlify account, защото в текущата сесия няма Netlify site/account connector или deploy token. След задаване на променливите направете първо staging deploy и проверете login, admin permissions, tRPC mutations и upload size behavior.

## Последователност в Netlify

1. Свържете repository-то към Netlify.
2. Оставете `netlify.toml` да зададе build command, publish и functions directory.
3. Добавете staging environment variables, без да публикувате secrets в Git.
4. Стартирайте deploy preview/staging deploy.
5. Проверете начална страница, `/products`, category/product SSR, `/api/trpc`, `/sitemap.xml`, login, admin read/write operations и storage resources.
6. Направете data/media reconciliation преди да променяте официалния DNS.
7. Запазете persistent Node deployment като fallback, докато direct upload storage и auth migration не бъдат потвърдени.

## References

[1]: https://docs.netlify.com/build/functions/configuration/ "Netlify Functions configuration and limits"
[2]: https://docs.netlify.com/build/functions/overview/ "Netlify Functions overview"
[3]: https://docs.netlify.com/build/configure-builds/file-based-configuration/ "Netlify file-based configuration"
