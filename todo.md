
# Catalogue-wide product image background refinement
- [x] Apply a high-specificity global override so `/products`, category listings, related-product cards, homepage product shelves, and detail galleries all use a clean white image surface.
- [x] Disable every catalogue image-area `background-image` grid with `!important`, including the workbench-specific and related-section rules that previously overrode the first fix.
- [x] Keep complete-image rendering with `object-fit: contain` for catalogue, related, and detail product images.
- [x] Verify `/products` at desktop and mobile sizes; 50 Vitest files / 176 tests, TypeScript, production client+SSR build, and `git diff --check` passed.

# По-спокойни цветове на категорийни снимки
- [x] Намалена е наситеността само за Инструменти, Градина, Баня, В и К, Бои/Лакове/Мазилки и Работно облекло, без потъмняване или преминаване към черно-бяло.
- [x] За дома, Осветление и ел. материали, Подови и стенни покрития, Врати/Обков/Крепежи и Строителство са оставени непроменени; продуктовите снимки, логото, цени, SKU и други продуктови данни не са променяни.
- [x] Реалните CSS филтри на всичките 11 категории са проверени в браузъра; изпълнен е desktop/mobile визуален преглед. Преминаха 51 Vitest файла / 178 теста, TypeScript, production client+SSR build и git diff --check.
