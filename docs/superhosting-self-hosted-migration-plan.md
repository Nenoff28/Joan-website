# План за пълно преместване на Joan.bg към SuperHosting

**Статус:** техническа оценка и план; не е извършвана миграция и работещият публикуван сайт не е променян.  
**Цел:** приложението, базата данни и продуктните файлове да бъдат под контрола на фирмения SuperHosting акаунт, вместо да зависят от текущото управлявано хостване.

> **Важно разграничение:** SuperHosting е външен хостинг доставчик. С този план данните ще са в инфраструктурата и акаунта на фирмата в SuperHosting, а не в текущата управлявана платформа. Ако изискването буквално забранява *всякакъв* cloud/външен доставчик, необходим е собствен сървър в офиса, а не SuperHosting VPS.

## 1. Извод от проверката

Текущият сайт е Node.js/Express приложение със SSR, tRPC API и MySQL, а не статичен HTML или стандартен PHP/OpenCart сайт. Това означава, че не трябва просто да се качи ZIP файл в `public_html`. Необходима е постоянна Node.js среда, MySQL база, защитено файлово хранилище, SSL, процес за рестарт и резервни копия.

SuperHosting официално поддържа Node.js приложения чрез cPanel „Setup Node.js App“ както на определени shared hosting планове, така и на Managed VPS; за собствен VPS Node.js се инсталира и управлява от администратора.[1] [2] За този проект **Managed VPS** е минималният препоръчителен вариант, защото комбинира cPanel, база данни, backup и мониторинг, но трябва предварително да се потвърди версията на Node.js и ограниченията на процеса.[3]

| Решение | Подходящо ли е | Причина |
|---|---:|---|
| Обикновен PHP/OpenCart shared hosting | Не | Приложението има Node/Express SSR сървър, API и контролирани upload-и. |
| Shared hosting с Node.js App | Условно | Поддържа Node.js и MySQL, но трябва писмено да се потвърдят Node 22+, runtime лимитите и възможността за production SSR процес. |
| **Managed VPS в SuperHosting** | **Да, при потвърдена съвместимост** | Node.js App, MySQL, cPanel, мониторинг и backup; по-малък оперативен риск за собственика. |
| Самостоятелен VPS | Да, но с администратор | Дава пълен контрол над Node, Nginx, MySQL, файлове и backup, но фирмата поема пачове, firewall, мониторинг и възстановяване. |

## 2. Критична съвместимост

SuperHosting посочва в публичната cPanel документация версии на Node.js до **20.10.0**.[2] Текущият build използва Vite 7, а официалната Vite документация изисква Node.js **20.19+ или 22.12+**.[4] Затова преди поръчка трябва да има писмено потвърждение от SuperHosting за **Node.js 22.12+** в production и build средата. Ако това не е възможно през cPanel, правилният вариант е собствен VPS с инсталиран Node 22 LTS, а не downgrade на работещото приложение.

| Компонент | Текуща роля | Self-hosted замяна в SuperHosting |
|---|---|---|
| Node/Express + SSR | Публичен сайт, админ панел, API, sitemap, SEO redirect-и | Node 22 LTS process зад Nginx или cPanel Passenger/Node.js App |
| MySQL/TiDB | Каталог, категории, наличности, заявки, клиенти, исторически поръчки, SEO | Фирмена MySQL 8/MariaDB база в SuperHosting; schema migrations + проверен SQL restore |
| Managed object storage | Продуктови изображения, галерии, брошури, икони и PDF | Локален файлов volume на VPS или фирмен object storage; URL адресите се пренаписват от `/manus-storage/...` към собствен `/media/...` |
| Manus OAuth | Текущ administrator sign-in | Локални administrator accounts с password hash, secure session cookie, rate limit и по възможност MFA |
| Managed secrets | DB URL, JWT, storage ключове, домейн настройки | `.env` файл извън web root, с owner-only права и отделни production/staging стойности |
| Managed hosting | TLS, rollout, runtime | SuperHosting SSL, reverse proxy, process restart, monitoring и backup процедура |

## 3. Данни, които се прехвърлят

Миграцията включва целия активен каталог и историческите записи, без да се редактира източникът им. Инвентаризацията на проекта включва 10 965 импортнати продуктови записа, 7 011 активни артикула, йерархия от 467 legacy категории, 195 производители, 274 клиентски профила, 881 исторически поръчки и 1 038 order lines. Публичните продуктови URL адреси и старите `legacy-…` redirect-и трябва да останат същите след прехода.

| Данни/файлове | Прехвърляне | Контрол за приемане |
|---|---|---|
| MySQL schema и данни | Consistent SQL dump, import в празна целева база | Row counts, foreign keys, индекси, sample read-only checks |
| Продуктови снимки, брошури и PDF | Download с hash manifest, upload във фирмено storage | Брой файлове, SHA-256, липсващи файлове, проверка на галерии |
| SEO и URL compatibility | Slugs, legacy slug-и, canonical/robots/meta данни | 301 tests, canonical tags, sitemap/robots, crawler HTML |
| Публични заявки и контактни форми | SQL export с ограничен достъп | Проверка на броеве и статутите, без показване на лични данни |
| Администраторски достъп | Не се копира текущият Manus OAuth identity | Създават се нови локални admin accounts преди cutover |
| Customer accounts | Съществуващите profile/credential таблици се прехвърлят | Изисква отделен тест за activation/reset; transactional email остава отделна, нерешена конфигурация |

## 4. Как ще стане преместването

Миграцията се прави първо на временен адрес, например `staging.joan.bg`, и не прекъсва текущия сайт. DNS за `joan.bg` се сменя едва след приемателна проверка.

| Етап | Действие | Условие за преминаване |
|---|---|---|
| 1. Provisioning | Създава се фирмен SuperHosting VPS/Managed VPS, staging subdomain, MySQL, SSH ключове, TLS и owner-only достъп | Потвърдени Node 22+, MySQL, storage, backup и достъп |
| 2. Portable adaptation | Премахва се зависимостта от текущите OAuth/storage endpoints и се добавят local auth + local media adapter | Няма runtime референции към текущия managed auth/storage |
| 3. Data/media transfer | Създават се SQL dump и hash manifest, файловете се качват в `/media`, URL адресите се обновяват контролирано | Counts и hash проверките съвпадат |
| 4. Staging acceptance | Тестват се публични маршрути, admin login, продуктови URL адреси, снимки, upload, sitemap, SEO и заявки | Functional, mobile и security QA е успешно |
| 5. Cutover | Понижава се DNS TTL предварително; кратко се спира записването на нови заявки; прави се final delta export; DNS се насочва към SuperHosting | Финален backup, health checks и rollback target са готови |
| 6. Stabilization | Наблюдават се logs, DB, диск, процес и 404/500 грешки; текущата версия се пази като rollback вариант | Писмено приемане от собственика |

## 5. Backup, сигурност и отговорности

Managed VPS има стандартен backup с до три архива седмично, а SuperHosting описва допълнителен VIP backup с до седем ежедневни пълни архива.[5] Това е полезна основа, но не е достатъчно само по себе си за критичен магазин. Препоръчвам ежедневен логически MySQL backup, ежедневен media manifest, редовен restore test и отделен криптиран backup, достъпен само за фирмения собственик. Ако политиката забранява дори втори външен backup, това трябва да бъде формално одобрено като риск.

Локалният administrator вход трябва да се реализира със съвременен password hash, `httpOnly`/`secure` cookies, CSRF защита, rate limit, audit log и минимум два отделни administrator акаунта. Пароли, SSH ключове и `.env` не се съхраняват в Git, cPanel file manager или публична директория.

## 6. Какво трябва да поиска собственикът от SuperHosting

1. Потвърждение за **Managed VPS или VPS**, не само PHP hosting.
2. Писмено потвърждение, че Node.js **22.12+** може да работи в production и да build-ва проекта.
3. MySQL 8 или съвместима MariaDB, с достатъчно място и права за import/export.
4. SSH/SFTP access, отделен deployment user и възможност за environment variables извън web root.
5. Staging subdomain, SSL certificates, production domain и DNS управление.
6. Потвърдено persistent storage място за всички изображения и PDF-и; размерът се измерва преди поръчката.
7. Backup политика, retention, restore процедура и лице за 24/7 инцидентен контакт.
8. Потвърждение дали собственикът желае Managed VPS с поддръжка или собствен VPS, за който фирмата носи системната администрация.

## 7. Решение, което препоръчвам

Най-балансираният вариант е **Managed VPS в SuperHosting с потвърден Node 22+**, MySQL, staging среда и ежедневни backups. Така данните и домейнът са във фирмения SuperHosting акаунт, но не се поема ненужен риск от администриране на Linux, firewall и process monitoring без системен администратор.

Не препоръчвам миграция директно към `joan.bg` или изтриване на текущата публикация. Първо се прави staging proof, после приемателна проверка и едва тогава обратим DNS cutover. Самият текущ сайт остава работещ, докато не бъде потвърдено, че self-hosted копието е пълно и стабилно.

## 8. Какво не е изпълнено още

Не са създавани SuperHosting сървър, DNS записи, локални administrator credentials, database dump или copy на медийните файлове. Не са променяни текущите продуктови данни, URL адреси, публикуван сайт или администраторски достъп. Реалната миграция започва само след избор на пакет и предоставен ограничен технически достъп до фирмения SuperHosting акаунт.

## References

[1]: https://help.superhosting.bg/node-js.html "SuperHosting: Node.js хостинг за Node.js сайтове"
[2]: https://help.superhosting.bg/setup-nodejs-app-cpanel.html "SuperHosting: Виртуална среда за Node.js приложения в cPanel"
[3]: https://blog.superhosting.bg/en/my-vps-first-steps-the-choice-of-management.html "SuperHosting: Getting Started With VPS — Management and Administration"
[4]: https://vite.dev/guide/ "Vite: Getting Started — Node.js compatibility"
[5]: https://help.superhosting.bg/managed-vps-vip-backup.html "SuperHosting: Допълнителен VIP backup при Managed VPS"
