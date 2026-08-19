# Joan Administration Platform: Initial Model

## Access Boundary

The public catalogue stays accessible without authentication. The `/admin` area and every management procedure require authenticated users with the `admin` role. The project owner is the initial administrator through the platform’s owner role mapping. No customer address, contact, or order-request information is exposed through public procedures.

## Core Records

| Record | Purpose | Key management fields |
|---|---|---|
| `Category` | Organises the public catalogue. | Name, slug, description, image URL, icon, sort order, active state. |
| `Product` | Drives public catalogue cards and product pages. | Name, slug, brand, description, category, EUR/BGN prices, promotional price, availability, stock quantity, images, features, active state. |
| `OrderRequest` | Stores a customer’s non-payment order request from the existing checkout form. | Contact and delivery fields, product snapshot, quantity, total snapshot, status, administrator note, timestamps. |
| `AdminActivity` | Captures material catalogue and order workflow events. | Administrator, action, entity type/ID, timestamp, concise metadata. |

## Initial Administrator Workflows

Administrators can view operational totals; create, edit, archive, and restore products; manage categories; update stock/availability and promotional pricing; review incoming order requests; transition request status; and write internal notes. The customer-facing checkout remains explicitly payment-free and submits an order request rather than a transaction.

## Migration Approach

The current 11 categories and 55 catalogue products will be imported once as initial records. Public pages will read database-backed records after the migration, while their existing Joan visual system, routes, product galleries, filters, favorites, and checkout handoff remain intact.
