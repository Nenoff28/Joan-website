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

**Няма:** онлайн плащания, куриерски API (Еконт/Спиди се споменават само като текст), email SMTP, ERP/Zeron синхронизация, cron задачи.

**Manus-специфични dev инструменти:** `vite-plugin-manus-runtime` и debug collector във `vite.config.ts` (пише в `.manus-logs/` в dev). Безвредни локално; при напускане на Manus може да се премахнат след одобрение.
