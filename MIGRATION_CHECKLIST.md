# Joan.bg Migration Checklist

## Implementation Status

| Scope | Status | Notes |
| --- | --- | --- |
| Joan visual system | Implemented | Red Workshop Modernism tokens, Joan Signal Red, accessible neutral surfaces, and Cyrillic-capable typography are defined in the frontend. |
| Joan-owned hero media | Implemented | The supplied `JOAN.mov` asset has been encoded as a web-safe muted H.264 MP4 and placed in the homepage hero. |
| Logo usage | Implemented | A generated symbol appears as the responsive application mark while the existing Joan logo asset is retained as contextual brand content. |
| Top-level categories | Migrated | The visible live-site taxonomy is mapped into reusable category data and mega-menu navigation. |
| Representative products | Migrated | The interface includes a small representative set of real visible homepage product titles, brands, and prices. It is not a complete product import. |
| Company story | Migrated | The source-supported 2001 founding year, facility sizes, supplier count, product stock count, address, phones, email, and hours are used on relevant pages. |
| Delivery information | Migrated | The published dispatch timing and stated exceptions are restructured in the delivery view. |
| Storefront functionality | Implemented as prototype | Search, category discovery, filters, sort selection, wishlist/compare counters, quantity, mobile navigation, and contact form behavior operate client-side. Checkout and customer accounts are not connected. |
| SEO foundation | Implemented | Semantic landmarks, title management, descriptive metadata, crawlable routes, and JSON-LD scaffolding are included. |

## Required Future Production Actions

| Priority | Action | Owner / dependency |
| --- | --- | --- |
| High | Import the complete approved catalogue with images, product codes, prices, promotions, availability, variants, technical attributes, and categories. | Joan catalogue/data source. |
| High | Connect secure cart, customer accounts, payments, order confirmation, and real inventory. | A chosen commerce backend; the current static site intentionally has no transaction layer. |
| High | Validate current terms, privacy policy, payment rules, returns, and delivery conditions with the business/legal owner. | Joan business/legal owner. |
| High | Map existing product and category URLs to their new canonical destinations with 301 redirects, then publish sitemap and robots directives. | Hosting/SEO owner. |
| Medium | Confirm social profile URLs and integrate only the official active profiles. | Joan marketing owner. |
| Medium | Supply approved business, store, category, and product photography where generated category art should be replaced with owned campaign assets. | Joan marketing team. |

## Known Limitations

The delivered project is a polished static storefront prototype designed for future catalogue integration. It does not assert real-time stock, full inventory coverage, shipping pricing, payment handling, authentication, or order submission. Representative product content is visibly drawn from the live homepage, while all customer-operation controls that need backend access remain intentionally non-transactional.

