# Joan.bg: Backup и технически достъпи преди миграция към SuperHosting

**Статус:** инструкция за подготовка; не изпълнява миграция и не променя текущия сайт.  
**Цел:** да има два независими, проверими backup комплекта и минималните нужни достъпи, преди да се създаде staging инсталация в SuperHosting.

> Не продължавайте към DNS прехвърляне, докато не е потвърдено възстановяване на база данни и поне един представителен набор файлове в отделна тестова среда. Архив, който не е тестван чрез restore, не е доказан backup.

## 1. Какво архивираме

За този сайт архивът не е само база данни. Необходими са и продуктните медии, source code, конфигурационна карта и DNS данни. Не поставяйте пароли, API ключове или `.env` стойности в Git, screenshot-и или споделен документ.

| Обект | Какво съдържа | Формат/местоположение | Проверка |
|---|---|---|---|
| Database dump | Каталог, категории, производители, клиенти, заявки, исторически поръчки, настройки и SEO данни | Шифрован SQL dump, отделен от source code | Restore в празна staging база + row-count проверки |
| Media export | Продуктови снимки, gallery изображения, брошури, PDF и бранд assets | Структуриран `/media` export + `SHA-256` manifest | Брой файлове, hash и browser проверка на sample URLs |
| Source code | React, Express, SSR, migrations, tests, deployment docs | Private Git repository + tagged release | `pnpm install --frozen-lockfile`, test и production build |
| Config inventory | Имена на environment variables, домейни, callback routes, cron/SMTP status | Секретите са в password manager; версия без стойности е в private docs | Peer review — никакви текущи managed keys не се копират |
| DNS/TLS record | A/AAAA/CNAME/MX/TXT записи и сертификатна политика | Export/screenshot от DNS panel и текстов inventory | Сравнение със staging и rollback plan |
| Cutover ledger | Точен timestamp на final export и freeze на записи | Подписан migration log | Final delta и backup ID са записани |

## 2. Предварителни правила за безопасност

Преди backup-а собственикът определя една папка или шифровано storage място, до което имат достъп само определени служители. Използвайте отделни копия: едно на защитен фирмен носител и едно в защитено място, различно от production сървъра. Ако политиката разрешава само SuperHosting, втората копия трябва поне да е в отделен защитен backup ресурс и да бъде договорена писмено като компромис по риска.

Подгответе лист с отговорници: собственик на данните, SuperHosting account owner, deployment administrator и лице, което може да одобри DNS cutover. Не изпращайте cPanel или SSH пароли през чат. Използвайте password manager или временен account с key-based SSH.

## 3. Стъпка по стъпка: backup на текущия сайт преди работа по SuperHosting

### Стъпка 1 — Създайте release baseline

1. Запишете текущия published checkpoint и Git commit/tag като **pre-superhosting-migration**.
2. Проверете, че TypeScript, тестовете и production build са успешни за този tag.
3. Съставете кратък manifest с: дата/час в `Europe/Sofia`, commit SHA, брой таблици, брой продуктови записи, брой файлове и отговорник.
4. Не правете cleanup, import или schema промени между baseline-а и първия backup.

### Стъпка 2 — Направете consistent database backup

1. Планирайте кратък прозорец, в който public checkout заявки временно не приемат нови записи. Това предотвратява разминаване между SQL dump-а и final delta.
2. Използвайте database-level export с транзакционно консистентен dump от източната MySQL съвместима база. Не архивирайте само отделни `catalogue_products` таблици.
3. Запазете export-а като например `joan-db-YYYY-MM-DD-HHMM.sql.gz` и генерирайте `SHA-256` hash файл.
4. Съхранете metadata файл без лични данни: export timestamp, schema version, commit SHA, размер на файла и checksum.
5. За final cutover направете втори, последен export след временното спиране на нови записи. Това е authoritative import файлът за production target.

> Не включвайте SQL dump с лични данни в Git. Customer profiles, адреси и заявки се третират като ограничени данни и се прехвърлят само през защитен канал.

### Стъпка 3 — Export на всички медийни файлове

1. Създайте пълен списък на медийните URL адреси от database полетата за primary image, gallery, manufacturer/category images, брошури и PDF.
2. Изтеглете файловете с възстановима структура, например `/media/products/`, `/media/brochures/`, `/media/brand/`.
3. За всеки файл запишете source key, нов относителен path, MIME type, размер и SHA-256. Не използвайте само CSV с външни URL адреси.
4. Проверете всички download-и за HTTP грешки и duplicate files; запазете отчет за missing assets вместо да замествате тихо изображения.
5. Архивирайте media директорията като `tar.gz` и създайте hash за архива и за manifest файла.

### Стъпка 4 — Export на source code и deployment конфигурация

1. Push-нете финалния source code към private Git repository и създайте immutable tag `pre-superhosting-migration`.
2. Архивирайте `package.json`, lockfile, `drizzle/` migrations, `docs/` и scripts. `node_modules`, локални caches и production secrets не се архивират в source bundle.
3. Направете `env.example` само с имената на променливите: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `CANONICAL_ORIGIN`, local storage root и mail configuration, когато бъде активирана. Не пренасяйте `BUILT_IN_FORGE_*`, `OAUTH_SERVER_URL`, `VITE_APP_ID` или други текущи managed credentials.
4. Документирайте новата local auth схема като migration task: текущият admin sign-in зависи от външен OAuth и не може безопасно да се копира като статичен key.

### Стъпка 5 — Направете restore proof, преди да приемете backup-а

1. Създайте празна staging MySQL база, различна от production целта.
2. Импортирайте SQL dump-а и изпълнете schema/row-count проверки за продукти, категории, свързващи таблици, заявки, клиенти, исторически поръчки и брошури.
3. Разархивирайте медийната папка на staging storage; сверете hash manifest-а и тествайте минимум: homepage asset, категория, продукт с gallery, PDF brochure и favicon.
4. Направете production build от tagged source и стартирайте приложението към staging DB/storage с отделен `JWT_SECRET`.
5. Тествайте публичен маршрут, стар `legacy-…` product redirect, canonical URL, sitemap, admin sign-in и read-only catalogue navigation. Не изпращайте истински заявки от staging.
6. Запишете резултата: `PASS`, timestamp, версия на dump-а, media manifest hash и подпис на отговорника. Само тогава backup комплектът е приемлив.

## 4. Какво SuperHosting трябва да предостави

Изисквайте отделни акаунти и минимални права. Не е нужно да се предоставя master password на SuperHosting профила за всекидневна разработка.

| Достъп | Нужен ли е | Минимален обхват | За какво служи |
|---|---:|---|---|
| SuperHosting account owner | Да, само за собственика | Пълен контрол при фирмата | Плащане, услуга, DNS ownership, support заявки |
| cPanel за staging | Да | Отделен staging account или staging domain | Node.js App setup, DB/user creation, File Manager, SSL и logs |
| cPanel за production | Да | Ограничен deployment/admin account | Deploy/restart и поддръжка след приемане |
| SSH с key authentication | Да | Non-root deployment user; без shared password | `pnpm install`, build, migrations, health checks, logs, file transfer |
| SFTP | Да | Само staging/prod app + media директории | Надежден upload/download на bundles и media export |
| MySQL user за application | Да | Само за конкретната production база | Runtime read/write от Node приложението |
| MySQL user за migration | Да, временно | CREATE/ALTER/INDEX/INSERT на конкретна staging/prod база | Controlled schema migration и SQL import; revoke/restrict след cutover |
| phpMyAdmin | Полезен | Само target database | Visual checks и аварийни малки restore проверки; не е основен deployment метод |
| DNS zone access | Да, само за собственик + одобрен администратор | `joan.bg`, `www`, staging records | TTL, staging, cutover и rollback |
| SSL/TLS control | Да | Domain validation и renew visibility | Валиден HTTPS за public/admin cookies и canonical URLs |
| Backup Manager access | Да, owner + backup operator | Generate/download/restore | Recovery без зависимост от един човек |
| Logs/process controls | Да | Node app restart, error logs, access logs | Проверка след deploy и инцидентна диагностика |

**FTP не е достатъчен и не е препоръчителен** за deployment. Ако се налага transfer на голям архив, използвайте **SFTP през SSH**; FTP може да остане само като резервна cPanel функция. SuperHosting посочва, че пълен cPanel archive може да се генерира и изтегли, а FTP е препоръчван за големи backup файлове.[1]

## 5. Точният въпрос към SuperHosting

Изпратете следното до тяхната поддръжка преди поръчка:

> Имаме production SSR приложение на Node.js/Express с React/Vite, MySQL, upload-и и дълготраен Node process. Моля потвърдете писмено: (1) възможна ли е Node.js 22.12+ среда за production и build; (2) може ли приложението да се стартира като `node dist/index.js` или еквивалентен Passenger entrypoint зад HTTPS домейн; (3) има ли SSH с key authentication и SFTP; (4) има ли MySQL/MariaDB с възможност за контролирани import-и и schema migrations; (5) какви са процесните, memory и execution лимити; (6) има ли staging subdomain и SSL; (7) какви backup/restore опции и retention се предлагат; и (8) може ли да се държат продуктови изображения и PDF файлове в persistent фирмено storage извън публичния source root?

Публичната SuperHosting документация потвърждава, че Node.js App се управлява през cPanel и поддържа environment variables, отделна app root директория, restart и `npm install`.[2] Тя обаче показва Node.js версии само до 20.10.0; затова писменият отговор за 22.12+ е задължителен за текущия Vite 7 проект.[2] [3]

## 6. Проверка преди DNS cutover

| Проверка | Успешен резултат |
|---|---|
| App health | Staging процесът стартира след restart и няма 5xx в error log |
| Database | Резултатите и избраните aggregate counts съвпадат с source backup metadata |
| Media | Manifest hash проверка преминава; няма legacy managed-storage URL зависимости |
| Auth | Local admin login, logout, protected route и failed-login protection са тествани |
| SEO | Canonical, 301 legacy product redirects, robots и sitemap работят на staging domain |
| Public workflow | Каталог, търсене, favourites, product detail, contact и request form са тествани |
| Recovery | Документиран restore от SQL и media archive е изпълнен поне веднъж |
| Rollback | DNS target и предишната работеща версия са записани и са достъпни |

## 7. SuperHosting backup след преместването

След миграцията използвайте пълния account backup в cPanel като допълнителна защита, но не като единствен backup. SuperHosting описва, че той може да съдържа файлове, бази, email и account settings, а Backup Manager позволява download и restore на файлове и бази.[1] [4] По време на restore текущото съдържание се презаписва, затова restore винаги първо се проверява на staging.[4]

Въвежда се следният минимален режим: ежедневен encrypted SQL dump, ежедневен media manifest, седмичен full account backup, месечен restore test и запис в backup ledger. При Managed VPS SuperHosting описва стандартен backup до три пъти седмично и допълнителен VIP вариант с до седем пълни ежедневни архива; проверете актуалните условия в конкретната оферта преди поръчка.[5]

## 8. Какво да не се предоставя

Не изпращайте по чат или email: master password за SuperHosting, необработен MySQL dump с customer data, SSH private key, `.env`, JWT secret, или изходни OAuth/storage ключове. Не предоставяйте root достъп за Managed VPS, ако SuperHosting може да осигури отделен deployment account. Не използвайте една и съща парола за cPanel, MySQL и administrator login.

## References

[1]: https://help.superhosting.bg/en/generate-full-backup.html "SuperHosting: How to Generate a Full Backup"
[2]: https://help.superhosting.bg/setup-nodejs-app-cpanel.html "SuperHosting: Node.js App in cPanel"
[3]: https://vite.dev/guide/ "Vite: Getting Started — Node.js compatibility"
[4]: https://help.superhosting.bg/en/backup-manager-by-superhosting.html "SuperHosting: Backup Manager"
[5]: https://help.superhosting.bg/managed-vps-vip-backup.html "SuperHosting: Managed VPS VIP backup"
