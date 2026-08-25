# Joan.bg: независим локален пакет

## Цел

Portable пакетът трябва да се стартира локално със същото Node/Express приложение, локална MySQL база и локално копие на всички медии. Той не трябва да прави заявки към `/manus-storage/`, managed storage, или външни продуктови image URL адреси.

## Какво вече е подготвено

1. `scripts/generate-portable-media-manifest.mjs` изгражда manifest от database и source-code media референциите.
2. `scripts/download-portable-media.mjs` изтегля файловете възстановимо, с SHA-256 report, в external export workspace.
3. `LOCAL_MEDIA_ROOT=/absolute/path/to/media` кара съществуващите `/manus-storage/<key>` URL адреси да се обслужват от локалната папка, без Forge/storage credentials.

## Локален runtime

| Компонент | Локална замяна |
|---|---|
| Node/Express SSR | `pnpm install --frozen-lockfile` и `pnpm build && pnpm start` |
| Product media, brochure и PDF | `LOCAL_MEDIA_ROOT=./media` с файловете от portable export-а |
| Database | Отделна локална MySQL/MariaDB инстанция и `DATABASE_URL` към нея |
| Public catalogue | Реален catalogue SQL restore, без връзка към текущата управлявана база |
| Administrator login | Изисква separate local-auth migration; текущият managed OAuth не се пренася като static credential |

## Данни, които не влизат в Git или обикновен source ZIP

Пълният database export съдържа клиентски профили, адреси, заявки и исторически поръчки. Той не се записва в repository и не се комбинира с source code в нешифрован архив. За локален full-data restore се създава отделен защитен database backup, който се предава само на определен от фирмата отговорник.

## Какво може да се изпълни без външни услуги

След local MySQL restore и зададен `LOCAL_MEDIA_ROOT`, публичните catalogue маршрути, продукти, изображения, галерии и брошура могат да бъдат разглеждани локално. Функции, които изискват managed OAuth, background integration или production email, не се считат за пренесени, докато не получат локална implementation/configuration.

## Защо медийните файлове не се добавят към текущото web project repository

Независимият media export е над 1 GB и включва хиляди файла. Той стои в отделен portable export workspace и влиза в download ZIP, а не в deployed web project source tree. Така текущият публикуван сайт не се натоварва с огромен Git/deployment artifact, но portable ZIP остава напълно независим от managed media URL адресите.
