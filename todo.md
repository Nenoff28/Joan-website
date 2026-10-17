
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
