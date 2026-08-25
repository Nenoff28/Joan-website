# Joan.bg: SuperPro readiness guide преди cPanel достъп

**Статус:** подготовка за миграция. Този документ не променя текущия публикуван сайт, DNS, база данни или файлове.

## Решение според реалната Node.js среда

| Проверка в SuperPro cPanel | Какво означава | Решение |
|---|---|---|
| `Software → Setup Node.js App` е налично и предлага актуален runtime | Може да се подготви staging Node/Express приложение | Продължаваме към staging proof, без DNS промяна |
| Node.js App е налично, но максимумът е Node 20.10 | Има потенциален compatibility path, но текущият runtime трябва да се тества и вероятно да се адаптира за тази версия | Никакъв production cutover преди успешен staging build, start, SSR и DB test |
| Node.js App липсва | SuperPro може да хоства само статични/PHP приложения | Не мигрираме full-stack версията на този пакет; не прехвърляме DNS |

> Публичната документация на SuperHosting показва cPanel Node.js версии до 20.10.0. Текущият проект трябва да бъде изпълнен с потвърдена съвместимост на реалната server версия, а production build-ът се извършва извън cPanel, освен ако SuperHosting потвърди актуален build runtime.

## Какво ще се провери веднага след получаване на достъп

1. От **cPanel → Software**: наличие на `Setup Node.js App`, списък с Node версии и процес за restart.
2. От **cPanel → MySQL Databases**: възможност за нова staging база и отделен database user.
3. От **cPanel → Domains**: възможност за `staging.joan.bg` или временен subdomain с SSL.
4. От **cPanel → Backup**: възможност за download/restore на файлове и база.
5. От **SSH**: `node -v`, `npm -v`, `pnpm -v`, свободно дисково пространство и достъп до app logs.
6. От **File Manager/SFTP**: отделна application root директория извън публичния web root и persistent `/media` директория.

След upload на staging bundle се изпълнява `node scripts/superhosting-preflight.mjs`. Скриптът проверява runtime версията и наличието на production bundle, без да чете, отпечатва или променя secret стойности.

## Подготвен staging ред

1. Създаваме само staging subdomain и празна staging MySQL база; `joan.bg` остава насочен към текущия работещ сайт.
2. Качваме immutable source release и prebuilt `dist/` bundle с проверени hashes; никакви production secrets не се качват в Git или web root.
3. Създаваме environment configuration извън public директорията с нови стойности за `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `CANONICAL_ORIGIN`, local media root и бъдещ SMTP/local-auth configuration.
4. Прехвърляме SQL dump и media archive единствено към staging. Правим restore proof и hash verification.
5. Тестваме SSR HTML, public catalogue, product redirects, images, brochure, request form, local admin access, sitemap и error logs.
6. DNS cutover се разглежда едва след писмено `PASS` за staging и наличен rollback backup.

## Неподвижни условия за безопасност

| Условие | Необходим резултат преди cutover |
|---|---|
| Runtime | Node process се стартира след restart и няма 5xx/SSR грешки в логовете |
| Данни | SQL restore, schema и ключови row counts са потвърдени |
| Медии | Всички тестови URLs работят от фирмено storage, без `/manus-storage/` зависимост |
| Сигурност | Нови local secrets, `httpOnly`/secure session cookies и отделен admin access |
| SEO | Canonical URL, sitemap, robots и legacy product 301 redirects са валидни на staging |
| Rollback | Старият DNS target и verified backup са достъпни преди промяна на DNS |

## Какво няма да направим предварително

Няма да променяме публичния DNS, няма да спираме текущия сайт, няма да прехвърляме клиентски данни през незащитен канал и няма да приемем Node.js App като достатъчен, без да е потвърден реален staging start. Ако SuperPro няма приложима Node среда, full-stack версията няма да бъде качвана като компромисен статичен export.
