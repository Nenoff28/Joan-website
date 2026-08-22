# Catalogue Reconciliation Validation

## Live legacy price verification

On 2026-08-22, the approved export's 10,965 products were checked item-by-item against the direct legacy OpenCart product route. The audit matched the active/inactive split exactly: 7,008 active product pages returned a normal or promotional EUR price, while 3,954 inactive legacy products returned the legacy not-found page. Three temporarily incomplete active checks were retried independently and confirmed as non-promotional at EUR 0.43, EUR 23.26, and EUR 4.80 respectively.

The reconciliation retained only 71 live promotional prices. This replaces the prior invalid treatment of historical, expired group-special rows as current promotions. The guarded live-price application updated 6,986 matching imported product rows; remaining rows are outside the active public product set or do not have a matching retained product record.

## Category and description validation

The corrected import maps active product paths under the actual legacy hierarchy. The public **Инструменти** category now contains 1,650 active imported products. Its **Електроинструменти → Бормашини** path resolves to 18 active linked products and rendered those real items with EUR prices in the desktop catalogue check.

The reimport also converted product descriptions from source HTML into readable text. A database check found zero imported product descriptions still containing HTML-tag markup.

## Performance validation status

The public category page now uses server-side filtering, sorting, and 48-item pagination. Product details, favourites, checkout, header search, and the homepage have been refactored to load compact product-specific data rather than the complete 7,011-product public catalogue. TypeScript validation passed after these changes; full automated and responsive validation remains pending.

Desktop and mobile route checks confirmed that the **Инструменти** category layout remains usable after the server-side pagination change. The drill subcategory rendered linked products rather than the former empty state. The targeted `Перфоратор BOSCH PBH2100 550W` product route loaded its single managed image and clean text description on both breakpoints. Empty checkout and favourites states also rendered normally with their compact product lookup logic.
