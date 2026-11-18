# JOAN онлайн магазин — Project Overview

_Проверено от кода на 2026-11-17. Бройките за production са от `PRODUCTION_DEPLOYMENT.md` (snapshot на Manus) и не са проверени повторно — production базата не е достъпна локално._

## Какво представлява

Full-stack TypeScript приложение (package `joan-bg-redesign`), създадено в Manus WebDev: React 19 SSR storefront + админ панел + Express/tRPC API върху MySQL-съвместима база (TiDB в Manus).

## Функционалности (статус)

| Област | Статус | Бележка |
|---|---|---|
| Публичен каталог: начало, `/products`, `/category/:slug`, `/product/:slug` | ✅ Проверено локално | Server-side пагинация/филтри (`catalogue.page`); SSR с prefetch |
| Търсене, филтри (марка, наличност, цена, промоция), сортиране | ✅ Проверено (UI) | Custom DB филтриране; няма външен search index |
| BG/EN език | ✔ В кода | `catalogue_*_english` таблици, `LanguageContext` |
| Количка, любими | ✔ В кода | Клиентски контексти (`CartContext`, `FavoritesContext`) |
| Checkout | ✔ В кода | **Без онлайн плащане** — създава `order_requests` (заявка), с опция за фактура (ЕИК/МОЛ) |
| Контактна форма | ✔ В кода | `contact_enquiries` + известие към собственика чрез Manus Forge |
| Клиентски профили | ✔ В кода | Собствени scrypt пароли, активиране с токен, Google OAuth (опционално) |
| Админ панел `/admin` | ⚠ Не работи локално | Вход само през **Manus OAuth** |
| Админ: продукти, наличности, промоции, категории, брошури, поръчки, запитвания, роли/права, импорт на клиенти/стари поръчки, експорт/импорт на база | ✔ В кода | Права в `shared/permissions.ts`, роли в `access_roles` |
| AI генериране на съдържание | ⚠ Само в Manus | Ползва Manus Forge LLM; background worker на всеки 5 s |
| Качване на изображения/брошури | ⚠ Само в Manus | `storagePut` изисква Forge storage |
| SEO: SSR, canonical, JSON-LD, `robots.txt`, `sitemap.xml` | ✔ В кода | `robots`/`sitemap` се регистрират само в production режим |
| Zeron/ERP синхронизация | ❌ Липсва | Само документи/шаблони за бъдеща интеграция |

## Production snapshot (по документацията)

11 020 продукта (7 011 активни), 478 категории, 195 производителя, 42 275 връзки продукт–категория, 274 клиентски профила, 881 стари поръчки, ~8 329 медийни файла (~1,1 GB).

## Хостинг

Подготвени са конфигурации за **Netlify** (`netlify.toml`, `netlify/functions/server.ts`) и runbook-и за **SuperHosting/self-hosted** (`docs/superhosting-*`, `PRODUCTION_DEPLOYMENT.md`). Кой хостинг е активен в момента не може да се установи от кода.
