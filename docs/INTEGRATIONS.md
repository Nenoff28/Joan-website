# Integrations

Само имена на променливи, без стойности.

| Интеграция | Env променливи | Къде в кода | Локално |
|---|---|---|---|
| MySQL/TiDB | `DATABASE_URL` | `server/db.ts`, `drizzle.config.ts` | ✅ локална MySQL 8.4 |
| Manus OAuth (админ вход) | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `JWT_SECRET` | `server/_core/oauth.ts`, `sdk.ts`, `context.ts` | ❌ няма локален админ вход |
| Manus Forge storage (качване на файлове) | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | `server/storage.ts`, `_core/storageProxy.ts` | ⚠ четене от `client/public/media` или `LOCAL_MEDIA_ROOT`; качване не работи |
| Manus Forge LLM (AI съдържание) | същите Forge ключове | `server/aiContentService.ts`, `_core/llm.ts` | ❌ |
| Manus известия към собственика | същите Forge ключове | `_core/notification.ts` (контактна форма) | ❌ (грешката не трябва да блокира — непроверено) |
| Forge Maps (frontend) | `VITE_FRONTEND_FORGE_API_URL/KEY` | `client/src/components/Map.tsx` | ❌ |
| Analytics (след cookie consent) | `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | `CookieConsent.tsx` | изключено |
| Google вход за клиенти | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | `server/googleCustomerAuth.ts`, `docs/google-login-setup.md` | изключено |
| Клиентски сесии | `JOAN_CUSTOMER_SESSION_SECRET` (fallback `JWT_SECRET`) | `server/customerAccounts.ts` | ✅ локален random secret |
| SEO | `CANONICAL_ORIGIN`, `SITE_NAME` | `_core/vite.ts`, `_core/production.ts` | `http://localhost:3000` |
| Еконт (офиси + цена) | `ECONT_API_URL`, `ECONT_USERNAME`, `ECONT_PASSWORD` | `server/couriers/econt.ts` | ✅ работи с интеграционния потребител (e-Econt > Профил > Интеграция за онлайн магазини); тест: `https://demo.econt.com/ee/services`, `iasp-dev` |
| Спиди (офиси + цена) | `SPEEDY_USERNAME`, `SPEEDY_PASSWORD` | `server/couriers/speedy.ts` | ⚠️ входът за MySpeedy връща „Достъпът е отказан“ — API трябва да се включи от Спиди |
| Тегло за цена | `SHIPPING_DEFAULT_WEIGHT_KG` (по подразбиране 2) | `server/couriers/shippingService.ts` | 2 кг |

**Няма:** онлайн плащания, товарителници/наложен платеж/проследяване (куриерите се ползват само за офиси и ориентировъчна цена), email SMTP, ERP/Zeron синхронизация, cron задачи.

**Manus-специфични dev инструменти:** `vite-plugin-manus-runtime` и debug collector във `vite.config.ts` (пише в `.manus-logs/` в dev). Безвредни локално; при напускане на Manus може да се премахнат след одобрение.


## Куриери: карта с офиси (2026-11-18)

- В поръчката: „До офис на Спиди или Еконт“ → карта (Leaflet + OpenStreetMap), търсене, филтър, списък; при избор — цена от куриера за 2 кг.
- tRPC: `shipping.offices` (кеш 24 ч, 5 мин при грешка), `shipping.quote` (кеш 15 мин, 30/мин на посетител).
- Изборът се записва в адреса на заявката: `Офис Еконт: <име> (<код>) — <адрес>; ориентировъчна доставка 6,70 €`.
- Куриер без потребител/парола не се показва; ако няма нито един — „Изборът на офис временно не е наличен.“
- **Живият сайт:** същите променливи трябва да се зададат в настройките на хостинга; CSP вече разрешава `https://*.tile.openstreetmap.org`.
- Дизайн: `docs/superpowers/specs/2026-11-18-courier-office-map-design.md`.
