# Joan.bg Website Audit and Redesign Architecture

## Audit Purpose

This document maps the visible Joan.bg content and behavior into a migration-ready redesign scope. It is based on a review of the live Joan homepage, contact, about, and delivery pages, together with the structural UX lessons observed from ManoMano and the background-video treatment observed on Kingfisher. The cited facts remain owned by the source pages and should be revalidated before a production data migration.[1] [2] [3] [4]

## Existing Content Structure

| Area | Current verified structure | Redesign treatment |
| --- | --- | --- |
| Product navigation | The visible top-level taxonomy covers tools, garden, home, bathroom, lighting and electrical materials, floor and wall coverings, plumbing, doors/hardware/fasteners, paints/lacquers/plasters, construction, and workwear.[1] | A search-first header, desktop mega menu, mobile drawer, and crawlable category routes preserve these top-level paths. |
| Product content | The homepage exposes brand, name, promotional and standard prices, wishlist/compare actions, and enquiry actions for real items including RTRMAX, Casa Bella, INTEX, and Baumit.[1] | Reusable product cards and a representative product-detail route preserve the fields and leave a defined path for catalogue import. |
| Customer operations | The existing header exposes login, wishlist, comparison, contacts, cart, delivery, brochure, and promotions.[1] | These remain explicit operational routes, with non-integrated actions clearly presented as interface prototypes rather than completed commerce transactions. |
| Contact & customer service | Joan publishes its Silistra address, four phone numbers, email, opening hours, and an enquiry form with product, service, delivery, and general topics.[2] | A structured contact page makes these details easy to scan and pairs them with an accessible form layout. |
| Company information | Joan states it was founded in 2001, began in metal trading, operates 7,200 m² of covered facilities and 22,800 m² of yard area, works with more than 300 firms, and maintains over 20,000 items in stock.[3] | A modern About page carries only these source-supported facts, separated from the shopping journey. |
| Delivery information | The current delivery policy states dispatch follows operator confirmation, is at the customer’s expense, and describes weekday and Saturday order cutoffs, alongside stated exceptions.[4] | The new service page reformats the verified policy into legible steps and preserves a source link for detailed legal copy. |

## Current-Experience Findings

The current interface includes the information customers need, but the search, category controls, utility links, commercial banners, and product cards compete for attention in a single compressed visual field. Category navigation is visible yet visually similar to surrounding controls; product discovery does not maintain a consistent sequence from image to name to price to action. The re-architecture therefore separates operational navigation from commercial content, gives search the strongest central position, and uses a durable product-card component that can absorb richer catalogue data later.

The existing business content is valuable and must not be replaced with generic claims. The redesign carries the verified contact details, operating hours, company history, facility figures, supplier count, stock figure, taxonomic labels, product examples, and delivery-policy essentials. Legal text, product stock states, customer-specific prices, detailed product attributes, payment methods, and active campaign data require a direct live-catalogue or business-owner validation before a production launch.

## Proposed Information Architecture

| Route | Purpose | Principal modules |
| --- | --- | --- |
| `/` | Discovery-led homepage | Video hero, category routes, promotional product rail, service reassurance, company section, footer. |
| `/category/:slug` | Scalable category and product listing | Breadcrumbs, category banner, context filters, sorting, product grid, pagination. |
| `/product/:slug` | Product decision page | Gallery, brand, product code, price, availability label, quantity control, enquiry CTA, technical data, related products. |
| `/about` | Company story and substantiated scale | Founded-year narrative, facilities, business range, practical principles, location CTA. |
| `/contact` | Direct contact and location | Address, phone, email, opening hours, enquiry form, embedded location panel. |
| `/delivery` | Customer delivery information | Dispatch timing, deadlines, exceptions, contact escalation. |
| `/terms` | Legal hand-off page | Clear production placeholder that preserves the current legal route and asks for approved legal copy before launch. |

## SEO and Migration Considerations

The existing source structure uses important URLs such as `/about`, `/contact`, `/delivery`, `/special`, category paths beginning with `/строителни-материали/`, and product detail URLs. Retaining these paths, or mapping them using server-side 301 redirects when a platform migration occurs, is essential to preserve discoverability. The frontend supplies clean semantic headings, descriptive page titles, a canonical base, internal links, and Product/Organization JSON-LD foundations. Production migration still requires a real catalogue feed, final product canonical URLs, server-configured redirects, sitemap generation, and validation in Search Console.

## Sources

[1]: https://joan.bg/ "Joan.bg homepage"
[2]: https://joan.bg/contact "Joan contact page"
[3]: https://joan.bg/about "Joan About page"
[4]: https://joan.bg/delivery "Joan delivery policy"
