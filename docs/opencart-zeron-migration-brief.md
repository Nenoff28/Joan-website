# Joan Catalogue Migration and Zeron Integration Brief

## Purpose

This brief defines the input package, field ownership, and staged workflow required to move the existing OpenCart catalogue into the Joan storefront and later keep operational data synchronized with Zeron ERP. No production customer information, order history, passwords, or direct database access is included in this scope.

## Required OpenCart package

| Source artifact | Required content | Import purpose |
|---|---|---|
| `products.csv` or SQL export | Product ID, SKU/model, barcode, name, description, manufacturer, status, tax class, base price, quantity, main image path, SEO keyword | Builds product records and establishes the durable SKU matching key |
| `categories.csv` or SQL export | Category ID, parent ID, name, description, sort order, image path, status, SEO keyword | Builds the category hierarchy and category URLs |
| `product_categories.csv` or SQL export | Product ID and category ID pairs | Preserves all product-to-category relationships |
| `product_images.csv` or SQL export | Product ID, image path, image sort order | Preserves product galleries |
| `specials.csv` and `discounts.csv` | Product ID, customer group, price, start/end dates | Carries promotions only when their rules can be represented accurately |
| `attributes.csv` and `options.csv` | Product ID, group, label, value, option value, price/stock adjustment | Preserves technical attributes and identifies variant-model gaps before import |
| `manufacturers.csv` | Manufacturer ID and name | Normalizes brands |
| `seo_urls.csv` | Old SEO paths and object routes | Supplies redirects from the legacy store when approved |
| `image/catalog/` ZIP archive | All source images with their original relative paths | Allows deterministic matching of product and category media |

The preferred raw-database alternative is a UTF-8 SQL export of the OpenCart product, description, category, product-to-category, product-image, manufacturer, promotion, attribute, option, and SEO tables, plus the `image/catalog/` archive. The OpenCart table prefix must be noted because it is not always `oc_`.

## Joan product mapping

| Joan field | OpenCart source | Rule |
|---|---|---|
| `catalogue_categories.slug` | SEO keyword or normalized category name | Unique Bulgarian-safe slug; preserve legacy URL separately for redirects |
| `catalogue_categories.name`, `description`, `imageUrl`, `sortOrder`, `isActive` | Category description and category data | Default missing visual metadata is held for administrator review, never fabricated |
| `catalogue_products.sku` | Model/SKU | Mandatory durable reconciliation key for every imported product |
| `catalogue_products.slug` | SEO keyword or normalized product name | Unique URL derived after SKU collision checks |
| `catalogue_products.name`, `description`, `brand` | Product description and manufacturer | Preserve original Bulgarian text and brand names |
| `catalogue_products.imageUrl`, `galleryJson`, `imageAlt` | Image paths and media archive | Upload approved image files to managed storage; retain relative source path in import audit metadata |
| `catalogue_products.priceBgn`, `oldPriceBgn`, `discountLabel` | Price and special/discount data | Prices remain in BGN source currency; EUR values are calculated or supplied only after commercial approval |
| `catalogue_products.stockQuantity`, `availability` | Quantity and status | Initially imported as a snapshot, then superseded by Zeron when the ERP integration is enabled |
| `catalogue_products.featuresJson` | Attributes and approved option labels | Technical data is imported as structured display features; variants require a separate representation decision |

## Field ownership after Zeron is enabled

| Domain | System of record | Direction |
|---|---|---|
| SKU, barcode, stock, operational sell status | Zeron | Zeron → website |
| Standard price, customer-group price, promotional price, promotion validity | Zeron | Zeron → website |
| Categories, brands, technical attributes, product text | Zeron by default; website editorial overrides only by agreed field rules | Zeron → website |
| Marketing images and extended gallery | Website by default unless Zeron exposes approved image URLs | Configurable, never overwritten silently |
| Customer order/request status | Zeron after confirmed order workflow is agreed | Website → Zeron, then Zeron → website status update |
| Legacy SEO redirects | Website | One-time OpenCart → website import |

## Integration boundary

The website must connect to Zeron through an approved service endpoint or managed recurring export. It must not expose or connect directly to the ERP database. Required controls are a dedicated service account, secret-managed authentication, least-privilege access, request logging without customer data leakage, retry-safe import identifiers, rate limiting, and a visible administrator sync log.

## Staged rollout

1. Receive a sample of approximately 20 representative products and their images.
2. Validate encoding, SKU uniqueness, category hierarchy, image matching, tax/price interpretation, promotion rules, and variants.
3. Import the full OpenCart catalogue into a non-public staging state; reconcile counts and exception lists.
4. Confirm Zeron’s supported service contract, authentication method, warehouse and price-list rules, and order workflow.
5. Enable Zeron synchronization first for a limited, approved product group; compare stock and price values against ERP.
6. Enable the complete catalogue only after the business owner signs off on the reconciliation report and recovery procedure.

## Information still needed from the user and vendors

The OpenCart administrator or hosting provider must supply the export package above. Zeron support must supply documentation or sample responses for the web-service or export interface, the authentication and network requirements, supported price-list and warehouse semantics, permitted polling frequency or callbacks, error codes, and the test environment if available.
