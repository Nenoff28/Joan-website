
# Catalogue-wide product image background refinement
- [x] Apply a high-specificity global override so `/products`, category listings, related-product cards, homepage product shelves, and detail galleries all use a clean white image surface.
- [x] Disable every catalogue image-area `background-image` grid with `!important`, including the workbench-specific and related-section rules that previously overrode the first fix.
- [x] Keep complete-image rendering with `object-fit: contain` for catalogue, related, and detail product images.
- [x] Verify `/products` at desktop and mobile sizes; 50 Vitest files / 176 tests, TypeScript, production client+SSR build, and `git diff --check` passed.

# По-спокойни цветове на категорийни снимки
- [x] Намалена е наситеността само за Инструменти, Градина, Баня, В и К, Бои/Лакове/Мазилки и Работно облекло, без потъмняване или преминаване към черно-бяло.
- [x] За дома, Осветление и ел. материали, Подови и стенни покрития, Врати/Обков/Крепежи и Строителство са оставени непроменени; продуктовите снимки, логото, цени, SKU и други продуктови данни не са променяни.
- [x] Реалните CSS филтри на всичките 11 категории са проверени в браузъра; изпълнен е desktop/mobile визуален преглед. Преминаха 51 Vitest файла / 178 теста, TypeScript, production client+SSR build и git diff --check.

# Нови естествени категорийни снимки и четливи надписи
- [x] Генерирани са пет нови различни снимки с естествена мека светлина и умерени цветове за Инструменти, Баня, В и К, Бои/Лакове/Мазилки и Работно облекло. Новите изображения не наследяват старите усилващи цветови филтри.
- [x] Петте снимки са компресирани до 1200 × 675 JPEG, качени в managed storage и записани само в imageUrl за точно тези пет категории. Синхронизирани са съответните fallback изображения в storeData.ts. Градина и петте предварително одобрени категории не са подменяни.
- [x] На всички 11 категории е добавен дискретен тъмен полупрозрачен панел със заобляне и сянка зад заглавието и описанието; текстът е бял. Продуктовите изображения, данни, цени, SKU и навигация не са променяни.
- [x] Проверени са реалните image URLs, липсата на цветови усилване при новите снимки и белият текст върху тъмния панел на всички категории. Изпълнени са desktop/mobile визуални проверки; преминаха 51 Vitest файла / 180 теста, TypeScript, production client+SSR build и git diff --check.

# Спокойна палитра в началото на началната страница
- [x] Премахнат е inline яркочервеният фон на категорийното меню; заменен е със светъл каменен тон, четлив графитен текст, приглушени виненочервени икони и тънък цветен акцент. Избраната категория получава дискретен неутрален фон вместо ярко червено поле.
- [x] „Разгледайте брошурата“ е графитен с бял текст и мек сив hover. Размерите, заоблянето, позицията и подравняването на бутоните и slideshow-а са запазени. Логото, останалите фирмени цветове и продуктовите данни не са променяни.
- [x] Добавени са проверки за новата палитра, AA контраст на текста, keyboard focus и запазени target-и на CTA действията. Проверени са desktop (1280px) и mobile (375px) изгледите. Преминаха 52 Vitest файла / 184 теста, TypeScript, production client+SSR build и git diff --check.

# Единен стил за двата бутона под slideshow-а
- [x] „Разгледайте брошурата“ остава плътен графитен бутон с бял текст; иконата вече наследява същия бял цвят.
- [x] „Продукти на промоция“ е със светъл каменен фон, графитен текст и сивографитен контур вместо червен. Двата CTA бутона споделят шрифт, размери, заобляне, сянка и focus оформление, но запазват визуална йерархия чрез плътен/контурен вариант. Hover на втория бутон е неутрален, не яркочервен.
- [x] Одобреното категорийно меню, подредбата, линковете, снимките и продуктовите данни са непроменени. Проверени са desktop (1280px) и mobile (375px) изгледите; преминаха 52 Vitest файла / 185 теста, TypeScript, production client+SSR build и git diff --check.

# Скриване на броя категории в началното меню
- [x] Премахнат е числовият индикатор „11“ от заглавието „Категории“ на началната страница. Самите 11 категории, менюто, иконите, подкатегориите и навигационните действия са запазени.
- [x] Добавена е regression проверка, че броят не се визуализира. Проверено е на desktop и mobile; преминаха 52 Vitest файла / 185 теста, TypeScript, production client+SSR build и git diff --check.

# Собствени клиентски профили, Google вход и потребители/роли
- [x] Добавяне на customer/operator/admin и персонализирани роли с избираеми права, backend permission checks и журнал на измененията.
- [x] Секция „Потребители и роли“ за търсене на клиентски профили, назначаване на роли и редакция на персонализирани роли.
- [x] Ограничени менюта, маршрутни проверки и read/write действия в административния панел; запазване на сегашния Manus администраторски достъп при прехода.
- [x] Собствена публична регистрация и Google OpenID Connect вход; новите профили винаги са customer, без автоматично даване на административни права по имейл.
- [x] Проверена schema миграция, regression тестове и визуален QA. Google live login изисква предоставени OAuth Client ID/Secret и разрешен callback URL; липсващи настройки не се заместват с фиктивни credentials.

- [x] Отстранени са откритите при browser QA mobile overflow и SSR lazy/Suspense recoverable error на admin entry routes. Хедърът използва lean identity за „Профил“ след собствен вход. Privacy страницата отразява регистрацията, Google идентификаторите и служебните роли.
- [x] Преминаха 58 Vitest файла / 220 теста, TypeScript, production client+SSR build и git diff --check. Изолираният browser QA с mock API потвърди създаване на custom роля, назначаване, операторски allowlist, пренасочване, отказ на забранен URL, read-only контролите и 375px mobile layout без page errors. Реалните анонимни admin заявки връщат 403. Тестови профили/поръчки не са записвани в production базата.
- [x] Целевият production crawler SSR verifier премина за home, catalogue page 1, profile loading shell, privacy, admin entry routes, index redirect и реални 404. Документирани са употребата на роли, собственият admin преход и Google настройването в docs/users-roles.md и docs/google-login-setup.md.
- [ ] Активиране и live проверка на Google OAuth след предоставяне на GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET и разрешен callback; към момента configured=false и бутонът е явно неактивен.
- [ ] IP allowlist след предоставяне на точните разрешени IP адреси и проверка на доверения reverse proxy, без риск от admin lockout.
- [ ] Отделен SEO follow-up: съществуващият SSR canonical на /products?page=2 сочи към /products. Не е променян в задачата за роли и вход.
