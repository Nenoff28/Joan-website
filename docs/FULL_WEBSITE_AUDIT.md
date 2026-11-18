# ЖОАН — пълен одит и безопасни подобрения

_Дата: 2026-11-17 · Среда: локално (Windows), изолирана MySQL `joan_local` с 55 примерни продукта, dev сървър `http://localhost:3000`, production build `http://localhost:3001`. Без commit, push или deploy._

## 1. Обща оценка

Магазинът има солидна основа: SSR, server-side пагинация и филтри, цени от базата (не от клиента), транзакции при поръчка, CSP с nonce, HSTS, качване само на JPEG/PNG/WebP, robots/sitemap, `noindex` на checkout/любими, коректен 404.

Основните проблеми бяха в **реалното изобразяване за Google и клиента**, не в архитектурата:

- продуктовите страници се рендерираха на сървъра като „Зареждане на продукта…“;
- 367 KB неизползваем Manus скрипт на всяка страница;
- текст под 12px в продуктовите карти;
- изрязан промо банер;
- хоризонтален скрол на таблет;
- вътрешни бележки за разработчици, видими за клиентите.

| Lighthouse (лабораторно, production build, симулирано устройство) | Преди | След |
|---|---|---|
| Accessibility (8 измервания) | 87–94 | **100** навсякъде |
| Best Practices | 93 | **100** |
| SEO | 100 | 100 |
| Performance desktop: начало / продукти / категория / продукт | 74 / 77 / 79 / 56 | **81 / 81 / 84 / 85** |
| Performance mobile: начало / продукти / категория / продукт | 55 / 49 / 54 / 34 | 55 / 49 / 55 / **55** |
| CLS продукт (mobile / desktop) | 0.548 / 0.412 | **0.081 / 0.032** |
| SSR HTML: начало / продукти / продукт | 534 / 597 / 428 KB | **166 / 230 / 79 KB** |

> Това са **лабораторни** измервания (Lighthouse, симулиран Moto G / desktop) върху локален сървър с 55 продукта. Не са реални потребителски данни (CrUX/RUM). INP не е измерван — няма надеждни полеви данни.

**Мобилният FCP/LCP остава висок (≈9–14 s лабораторно).** Причината е структурна: 1.1 MB JS + 348 KB render-blocking CSS + неоптимизирани изображения. Решението изисква code splitting и оптимизация на медии — виж P1-14 и P1-15, които чакат одобрение.

## 2. Проблеми по приоритет

Легенда: ✅ поправено · ⏳ чака одобрение · ℹ️ ограничение

### P0 — критични

| # | Страница / компонент | Описание | Доказателство | Въздействие | Решение | Риск от регресия | Статус |
|---|---|---|---|---|---|---|---|
| 1 | Продуктова страница, SSR (`client/src/ssr/prefetch.ts`) | SSR prefetch записва продукта под ключ `{slug}`, а страницата чете `{slug, language}` → сървърът рендерира `<h1>Зареждане на продукта…</h1>`, без описание, цена и `Product` schema | `curl /product/banya-test-1` → h1 „Зареждане…“, 0 JSON-LD; Lighthouse CLS 0.548 (клиентът подменя цялата страница) | Google индексира 10 000+ продукта като празни „loading“ страници; голямо разместване | Ключът включва `language: "bg"` (както при категориите) | Нисък: същите данни, само правилен cache key; нов поведенчески тест | ✅ |
| 2 | Поръчка (`server/catalogueService.ts` → `createOrderRequest`) | Витрината показва цена по активна **кампания** (`publicProduct`, ред ~450–466), а заявката записва базовата `priceEur` (ред ~1512), без кампанията | Разминаване, видимо в кода. Runtime възпроизвеждането в локалната база беше маскирано от публичния кеш (`cachedPublicRead`) и не е завършено | Екипът вижда по-висока сума от показаната на клиента → спор за цена | В транзакцията да се прилага `activePromotionsByProductIds` със същата формула + тест с кампания | Среден (пари, checkout) | ⏳ изисква одобрение |

### P1 — висок приоритет

| # | Страница / компонент | Описание | Доказателство | Решение | Статус |
|---|---|---|---|---|---|
| 3 | Production SSR на Windows (`server/_core/production.ts`, `vite.ts`) | `import("C:\\…")` → `ERR_UNSUPPORTED_ESM_URL_SCHEME`, сървърът връща празен shell на всяка страница | Лог `[SSR] render failed`; идентичен HTML 368 973 B за всички URL | `import(pathToFileURL(path).href)` — работи и на Linux; тест | ✅ |
| 4 | Всички страници (`vite.config.ts`) | Inline скрипт `manus-runtime` (367 KB) в началото на `<body>` в production; блокиран е от CSP, но се сваля и парсва | `dist/public/index.html` 368 KB; Lighthouse „CSP violation“ | Плъгинът само в dev (`apply: "serve"`) → `index.html` 894 B | ✅ |
| 5 | Начало | Няма `<h1>`; оригиналният беше закоментиран, а тестът минаваше заради коментара | Playwright: h1=0 на 8 ширини | Визуално скрит `<h1>` „Строителни материали“ (съвпада с title/description); тестът проверява реалния елемент | ✅ |
| 6 | Header (`Storefront.tsx`) | Двоен breadcrumb на каталог/продукт/любими; етикет „Представителен продукт“ на всеки продукт | Screenshot `/products` 1440 | Общият breadcrumb само там, където страницата няма собствен | ✅ |
| 7 | Начало — банер | `object-fit: cover` на 3:2 артуърк в 2.25:1 кутия изрязва горе логото, долу **цената 159 €**; снимката е 640px, разтегната до 989px | Screenshot before/after | `object-fit: contain` (целият банер се вижда) | ✅ / ⏳ нужен банер 2.25:1 ≥1980px от фирмата; 4-те слайда са една и съща снимка |
| 8 | Таблет/мобилен | Хоризонтален скрол: `/products`, `/product`, `/contact` на 768px; `/contact` на 320px | Playwright: scrollWidth 866/787/792/332 | `minmax(0,…)` колони, `min-width:0`, `flex-wrap` на пагинацията | ✅ 0/64 overflow |
| 9 | Продуктови карти, header | Текст 8.96–10.9px (марка, наличност, промо етикет, характеристики, стара цена, етикети „Вход/Любими/Количка“) | Impeccable detector: 273 undersized + 69 tiny | Минимум 12px; заглавие 14px | ✅ (72 + 4 остатъка, предимно admin/брошура) |
| 10 | Контраст | Сив помощен текст 4.1:1, placeholders 3.0–3.4:1, червени надписи 4.45:1, „По запитване“ 4.4:1 | Detector + Lighthouse `color-contrast` | `--slate`, `--red-deep`, по-тъмен оранжев | ✅ |
| 11 | `client/index.html` | `maximum-scale=1` пречи на zoom (WCAG 1.4.4) | Lighthouse `meta-viewport` | Премахнато; полета ≥16px на мобилен (без iOS auto-zoom) | ✅ |
| 12 | Текстове | Вътрешни бележки, видими за клиенти: „мигрираните исторически поръчки“, „Свържете тази секция с…“, „представителни артикули“, „реални артикула“ | Screenshots | Клиентски формулировки със същия смисъл, без нови твърдения | ✅ |
| 13 | Каталог 761–900px | 2 хоризонтални карти с текстова колона ~112px → заглавия дума по дума | Screenshot before | 1 карта на ред в този диапазон | ✅ |
| 14 | Производителност | Публичен JS 1 134 KB (338 KB неизползван), CSS 348 KB (232 KB неизползван), render-blocking; mobile FCP ~9–10 s (лаб.) | Lighthouse `unused-javascript`, `render-blocking-resources` | Lazy-load за страници/тежки компоненти; разделяне на CSS; self-host шрифтове | ⏳ план, изисква одобрение |
| 15 | Изображения | Икони в footer-а: PNG 75–227 KB при ~24px; категорийни снимки са по-големи от нужното (577 KB възможна икономия) | Lighthouse `uses-responsive-images` | Оразмерени WebP копия (оригиналите остават), `srcset` | ⏳ (създаване на нови медии) |
| 16 | Сигурност — зависимости | `pnpm audit --prod`: 68 (1 critical, 18 high). Достигат до публичния сървър: `express` / `body-parser` (DoS), `path-to-regexp` (ReDoS; override към 0.1.13 не е в lockfile), `zod`, `proxy-addr` (critical, само при `trust proxy`, който не е зададен) | `pnpm audit` | Patch ъпгрейди в рамките на major + rebuild + тестове | ⏳ |
| 17 | Сигурност — лимит на тялото | `express.json({ limit: "50mb" })` глобално → публични endpoints приемат 50 MB | `server/_core/index.ts:38` | 1 MB по подразбиране, 50 MB само за admin upload маршрутите | ⏳ |
| 18 | Мобилно търсене | Няма поле за търсене в header-а на мобилен; търсачката е в менюто | Playwright 375px | Видима иконка/поле в мобилния header | ⏳ UX промяна |

### P2 — среден приоритет

| # | Описание | Статус |
|---|---|---|
| 19 | Липсваше `BreadcrumbList` schema | ✅ добавена (относителни URL — проверка с Rich Results Test след deploy) |
| 20 | Фалшиви „технически кодове“ от CSS („CAT—FILTER“, „ITEM“, „PDP—01“) и дублиран надпис „Обобщение на заявката“ в checkout | ✅ премахнати |
| 21 | AI-шаблонни белези: 12 малки червени надписа (eyebrow) над почти всяко заглавие; двуезични декоративни ленти („Наличност · цена · …“); фон с райета/мрежа; pill бутони под банера; дублиран eyebrow „Пълен каталог“ | ⏳ визуална промяна — нужна е посока |
| 22 | `/products`: hero блокът изтласква първите продукти до ~760px на desktop | ⏳ layout промяна |
| 23 | Категорийна пагинация: `?page=2` има canonical към страница 1, а SSR винаги рендерира страница 1 | ⏳ SEO/URL промяна |
| 24 | Hashed assets се кешират 1 ден; може `max-age=31536000, immutable` | ⏳ |
| 25 | `xlsx` (admin импорт) — уязвим, няма поправена версия в npm | ⏳ замяна или изолиране |
| 26 | `admin.databaseImport` изпълнява произволен SQL с изключени FK проверки (само admin, с checksum) | ℹ️ по дизайн; да се ограничи до staging |
| 27 | 6 стари падащи теста (остарели пътища `/manus-storage/`, production env) | ⏳ |
| 28 | `Product` schema: относителни снимки, без `url`; SKU липсва в локалните данни | ⏳ |

### P3 — козметични

- Бутонът на количката на desktop няма `aria-label` с броя.
- Категорийните снимки изглеждат генерирани — препоръчват се реални снимки от обекта.
- `straggler` (една дума на последния ред) в няколко параграфа.

## 3. Какво е проверено и как

| Проверка | Инструмент | Резултат |
|---|---|---|
| Type-check | `corepack pnpm check` | exit 0 |
| Unit/regression | `corepack pnpm test` | 369 ✅ / 6 ❌ — същите 6 като преди одита; +3 нови теста |
| Нови регресионни тестове | `server/ssrProductPrefetch.test.ts`, `server/ssrEntryImport.test.ts` | Червен → зелен (провалят се без поправката) |
| Production build | `vite build` ×2 + `esbuild` | exit 0, 0 грешки |
| SSR на production | curl | h1, `Product`/`Offer`/`BreadcrumbList`, 404 статус, 0 SSR грешки |
| Responsive | Playwright, 8 страници × 8 ширини (320–1920) | 0 overflow, h1 навсякъде, 0 JS грешки |
| Функционални сценарии | Playwright, 1440 и 375px | 24/25: търсене, сортиране, филтър „На склад“, празен резултат, количка (добавяне, количество, премахване), checkout валидация + **тестова заявка в локалната база**, мобилно меню, контактна форма. Единственият „провал“ е P1-18 |
| Дизайн детектор | Impeccable `detect` (1280 и 390px) | low-contrast 25→5, undersized 273→72, tiny 69→4 |
| Lighthouse | 4 страници × mobile/desktop, преди/след | таблица в т.1 |
| Сигурност | `pnpm audit`, преглед на raw SQL, `dangerouslySetInnerHTML`, upload, auth, поръчки | т.2 (P0-2, P1-16, P1-17, P2-25/26) |

### Ограничения

- Локалната база има **55 примерни продукта**, не реалните 11 020. Каталожните SEO проверки при пълен мащаб не са изпълнени: дублирани URL, продукти без снимки или описания, празни категории, счупени връзки. Нужен е SQL snapshot.
- Админ панелът не е тестван — изисква Manus OAuth.
- Реални плащания няма; checkout създава заявка. Тестовите заявки `J-20261117-97669` и `J-20261117-2D239` са **само в локалната `joan_local`**.
- Lighthouse е стартиран програмно през Playwright Chromium, защото `chrome-launcher` не може да стартира Chrome в тази среда.

## 4. Променени файлове

**Код**
- `client/src/ssr/prefetch.ts` — правилен SSR ключ за продукта.
- `server/_core/production.ts`, `server/_core/vite.ts` — `pathToFileURL` при зареждане на SSR bundle-а.
- `vite.config.ts` — Manus runtime само в dev.
- `client/index.html` — без `maximum-scale`.
- `client/src/pages/Home.tsx` — `<h1>`; „Най-продавани“ се скрива, когато е празна; клиентски текстове; премахнат мъртъв закоментиран код.
- `client/src/components/Storefront.tsx` — без двоен breadcrumb; `BreadcrumbList` schema.
- `client/src/components/CookieConsent.tsx` — `<div role="dialog">` вместо невалидния `<aside role="dialog">`.
- `client/src/contexts/LanguageContext.tsx` — 4 текста (BG + EN).
- `client/src/index.css` — 6 стойности `content: none` + коментиран блок „Audit fixes 2026-11-17“ в края.
- `client/src/components/productCardBrandLogo.css` — наличност 0.62 → 0.78rem.

**Тестове**
- Нови: `server/ssrProductPrefetch.test.ts`, `server/ssrEntryImport.test.ts`.
- Обновени (проверяваха мъртви коментари или стари стойности): `homeSeo`, `brochureViewer`, `categoryHierarchy`, `englishLocalization`, `checkoutCopy`.

**Документация/доказателства:** `docs/FULL_WEBSITE_AUDIT.md`, `docs/audit-screenshots-2026-11-17/` (before/after screenshots, Lighthouse JSON, Playwright резултати).

Продуктови данни, цени, наличности, схема на базата, миграции, URL адреси и медии **не са променяни**.

## 5. Before / after screenshots

`docs/audit-screenshots-2026-11-17/`:

- `before-home-banner-1440.png` → `after-home-banner-1440.png` — целият банер с цената.
- `before-products-768.png` → `after-products-768.png` — четими карти на таблет.
- `before-contact-768.png` → `after-contact-768.png` — без хоризонтален скрол.
- `before-product-375-fullpage.png` → `after-product-375-fullpage.png`.
- `checkout-validation-1440.png`, `mobile-menu-375.png`.

## 6. За локален преглед

Dev сървърът е на `http://localhost:3000` (команда в `docs/DEVELOPMENT_WORKFLOW.md`):

1. `/` — банерът се вижда изцяло, без празната секция „Най-продавани“.
2. `/products` — на 768px (DevTools) и на мобилен; един breadcrumb.
3. `/product/banya-test-1` — текстът „Как публикуваме отзиви“.
4. `/contact` на 320 и 768px.
5. `/checkout` с продукт в количката.

Production build (SSR, както го вижда Google): `http://localhost:3001` → View Source на продуктова страница.

## 7. Чака одобрение (предложен ред)

1. **P0-2** — кампанийна цена в заявката: тест с кампания и поправка в `createOrderRequest`.
2. **P1-16 / P1-17** — patch ъпгрейди на `express`, `body-parser`, `zod`, `axios`, `path-to-regexp`; лимит 1 MB за публичните endpoints.
3. **P1-14 / P1-15** — code splitting, оптимизирани WebP икони и снимки (оригиналите остават).
4. **P1-18** — видимо търсене в мобилния header.
5. **P2-21 / P2-22** — визуална посока за премахване на AI-шаблонните елементи (eyebrows, декоративни ленти, райета, pill бутони) и по-нисък hero на `/products`.
6. **P1-7** — реални широки банери от фирмата; **P2-23** — каноникализация на пагинацията.
