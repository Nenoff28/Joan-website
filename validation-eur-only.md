# EUR-Only Catalogue Validation — 22 August 2026

- Public catalogue cards at `/products` render managed product images and EUR-only price strings at desktop and 375px mobile widths.
- Representative imported product `/product/legacy-50-avocet` renders its managed primary image, promotion state, raw EUR price of `105.90€`, and no BGN display at both breakpoints.
- `/favorites` and `/checkout` contain no BGN price presentation at either breakpoint.
- Authenticated `/admin/products` shows only **Цена EUR** and **Стара цена EUR** inputs at desktop and mobile widths; the responsive mobile form remains single-column and usable.
- The product table was still loading during the full-page screenshots, so record-level editor interaction remains an administrator-owned manual verification item.
