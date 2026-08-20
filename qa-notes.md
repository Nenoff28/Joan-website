# Extended Storefront QA Notes

The enhanced RTRMAX product page renders the compliant review area with an explicit verified-feedback empty state and no fabricated customer content. It renders the recommended-product rail, exposes a direct checkout route for the priced product, and switches the operational header, product-decision controls, review section, recommendations, and checkout labels from Bulgarian to English through the BG/EN control. Product names and source-backed descriptions remain in their original catalogue language.

The English mock checkout opens with the selected RTRMAX product, quantity, accurate representative price, and a prominent non-payment disclosure. Submitting the blank form exposes field-level validation messages for contact information, delivery address, postcode, and the mandatory demonstration acknowledgement without navigating away or creating an order.

The successful-path test uses non-sensitive demonstration values only. Once the acknowledgement checkbox is selected, all client-side constraints are satisfied and the simulated submission can be completed without transmitting data.

The mobile product page preserves the compact operational spec strip, truthful review state, recommendation cards, and checkout entry. The mobile checkout keeps the contact and delivery fields, non-payment notice, order summary, and request-confirmation action legible without horizontal overflow.

Test-catalogue QA: the Lighting and Electrical category renders five distinct test records, exposes three brand filters, and includes direct product and checkout routes for every product. The `osvetlenie-test-1` detail route renders price, specifications, a test-catalogue disclosure, and three recommendations from the same category.

The new checkout route accepts `osvetlenie-test-1` with quantity three, preserves the selected product in its summary, and calculates a €41.70 total. A blank submission stays on the checkout page and shows all required field-level validation messages, including the test-form acknowledgement.

Language switching was confirmed from English back to Bulgarian on the populated checkout route without losing the selected product or quantity. Price sorting in Lighting and Electrical was corrected and verified: the five results reorder from €3.80 through €19.60.

Successful-path setup for `osvetlenie-test-2` preserves quantity two and a €7.60 total. The form accepts non-sensitive demonstration data while retaining the clear test-form acknowledgement requirement.

After acknowledgement, the populated `osvetlenie-test-2` checkout reaches its explicit local success state. It confirms that no order was created and no data was sent, preserving the test-only checkout boundary.

Global search was verified with “Цимент” and routed directly to `stroitelstvo-test-1`. That product page shows the matched Construction record, a priced checkout route, and three same-category recommendations.

After source-name mapping, the Instruments category displays exact Joan catalogue labels and individual source product photos. The PREMIUM filter reduced the list from five items to two matching records, and the low-to-high price sort changed the active sort state without navigation or runtime errors.

The exact-source product detail route exposes a two-image gallery. Selecting thumbnail 02 replaces the primary source product image with the contextual category image while retaining the quantity controls, checkout action, technical data, and recommendations.

Selecting the “Приближи” control opens an accessible modal dialog containing the active gallery image. The close action returns to the unchanged product-detail state, confirming both opening and closing paths work without navigation.

Desktop and mobile screenshot review confirmed that source-named products, filter controls, sort options, thumbnail gallery, zoom control, purchase action, and related products remain legible and reachable. The final console and network-log pass recorded no runtime exceptions or 4xx/5xx product-media requests.

Brochure viewer correction QA: after a fresh preview navigation, the homepage loaded successfully. The interactive control list exposed previous-page, next-page, fullscreen, and numeric page controls, while the pause control was no longer present. Fullscreen and responsive visual checks remain in progress before publishing.

Desktop brochure verification: the adjacent pages render as complete portrait sheets without an added white frame or crop. Opening the actual fullscreen control produced a bounded dark viewer with the active sheet, complete angled neighboring sheets, navigation, and an exit control all remaining visible.

Automatic-rotation verification: a browser-timed 7.5-second check advanced the active brochure caption from page 02 to page 03. The pause control remained absent from the interactive control list.

Mobile fullscreen verification: Chrome device emulation at 375×812 entered fullscreen successfully. The viewer shell filled the 375×812 viewport, the stage remained within the screen at 339.84×716.23 pixels, all three controls were visible, and no pause element existed. The captured view showed the active sheet and compact page navigation without clipping or horizontal overflow.

The refreshed desktop preview continued to expose labelled previous, next, fullscreen, and numeric-page controls while automatic rotation advanced the displayed page during review.

Keyboard exit check: entering fullscreen through the visible control and pressing Escape returned the viewer to its normal layout and restored the fullscreen control label to “Отвори брошурата на цял екран”.

Focus and keyboard check: after Escape, focus returned to the fullscreen trigger. The brochure stage accepted focus and an ArrowRight key press moved the active brochure page while preserving the stage’s visible red focus outline.

Mobile fullscreen exit check: the same visible fullscreen control successfully exited the 375×812 emulated fullscreen view. The document reported no remaining fullscreen element, the viewer returned to a 665.25-pixel normal-layout height, the trigger remained visible, and its “Отвори брошурата на цял екран” label was restored.

Header-navigation refinement QA: desktop review shows a single red square menu trigger with three white lines, followed only by “Начало”, “За нас”, and “Контакти”. Activating the icon-only trigger exposes the existing complete category menu, including all eleven category links and the all-products link. Mobile review retains the compact menu icon with no horizontal overflow.

Mobile header-drawer QA: device emulation at 375×812 opened the drawer through its menu button. It showed “За нас”, “Контакти”, and all eleven category links without horizontal overflow; the close control then removed the drawer cleanly and preserved the no-overflow state.

Category hierarchy QA: the public Joan-style tree is represented as eleven top-level categories, with second- and third-level paths kept separate from product data. Desktop category navigation now uses a readable tabbed workspace: selecting a top-level tab exposes its complete hierarchy, including Инструменти → Електроинструменти → Бормашини and Инструменти → Ръчни инструменти → Бъркалки. Each branch has a route-safe path parameter and remains accessible from the icon-only header trigger.

Mobile category hierarchy QA: at 375×812 device emulation, the menu drawer showed all eleven top-level disclosure controls. Opening Инструменти and then Електроинструменти exposed the Бормашини route; the drawer retained the renamed informational links, closed correctly, and remained free of horizontal overflow.

Deep route QA: `/category/instrumenti?path=Електроинструменти > Бормашини` now renders the selected path, a zero-product count, and a clear truthful state explaining that the published subcategory is ready for product assignment. It does not show unrelated top-level test products. The protected administrator category workspace redirected to the standard sign-in boundary in this browser session; its structured-tree contract is instead covered by the authenticated procedure regression test.

Main brochure framing QA: the active PDF-rendered page was inspected at its native 1011×1418 portrait dimensions and contains no white side content. The central viewer frame was aligned to that native ratio; the subsequent desktop browser review showed the page image reaching both sheet edges without artificial left or right white gutters.

Fullscreen framing QA: opening the corrected main page in the real fullscreen control retained the portrait-ratio central sheet, with the brochure image reaching the left and right edges of its physical frame. The surrounding viewer remained the intended dark/neutral stage treatment rather than white image gutters, and the fullscreen exit control stayed visible.

Non-cropping main-sheet QA: after replacing the temporary crop treatment, desktop checks included both the photo-led page 03 and the white-background page 07; their full top, bottom, left, and right printed edges remained visible inside the native-ratio frame. Mobile emulation measured a 328.64×461.45 rendered sheet against the 1011×1418 source image, with the frame and image rectangles exactly aligned and `object-fit: contain`. The fullscreen page 01 check likewise retained its complete printed border and visible exit control. A regression test now locks normal and fullscreen active-page framing to the native 1011:1418 ratio and non-cropping `contain` behavior.

Brochure-heading refinement QA: the requested copy now reads “Разгледайте офертите от месечната брошура.” The metadata badge displays only the active brochure title at the requested 20px emphasis; controls, page numbers, side previews, and the main viewer retain their original scoped typography without broad inline overrides.

Mobile heading QA: at a 375px viewport, the revised heading wraps naturally above the brochure, the 20px “Промо брошура” badge stays within the content frame, and the restored viewer controls remain compact. The central brochure page retains its full native-ratio content under the heading.

Hero and brochure refinement QA: the desktop hero now presents “Всичко за ремонта на едно място” as a single 55px display line without scaling adjacent hero content. At 375px, the existing mobile heading rule preserves a legible three-line arrangement, with normal-size CTA and utility content. The brochure index prompt reads “Разгледайте офертите”, while the title badge is 15px and the viewer controls remain compact.

Hero restoration QA: the desktop hero has been returned to the prior large two-line composition, with “Всичко за ремонта” above the softly tinted “на едно място”. The comma and final period remain removed from the accessible heading copy. At 375px, the restored composition wraps naturally with the CTA and lower hero note remaining visible and unobstructed.

Catalogue discovery update — 2026-08-20: `/products` now identifies as the complete catalogue, exposes all eleven category shortcuts, and returns **55 от 55 продукта** across multiple categories with the existing filter and sorting controls. On desktop, `/category/instrumenti` renders its six parent groups and visible third-level entries without clipping; selecting “Електроинструменти › Бормашини” updates the deep `?path=` route and displays the truthful no-assigned-products state. Captured 375×812 views of both pages remained readable with no horizontal overflow. Final checks passed: `pnpm check` had no TypeScript errors, `pnpm test` passed 28 tests, and `pnpm build` completed successfully; the build retains its existing advisory warning for a large generated JavaScript chunk.

Global route-scroll QA — 2026-08-20: a single Wouter-aware scroll-reset component now runs an immediate `window.scrollTo(0, 0)` whenever the location changes, temporarily overriding the site’s smooth-scrolling style so page transitions are not animated. A real browser check first scrolled the desktop page to 704px, followed the route to `/products`, and measured `scrollY: 0`; it then emulated a 375px mobile viewport, scrolled to 700px, followed the route to `/contact`, and measured `scrollY: 0`. The same implementation covers public, catalogue, product-detail, checkout, favorites, and administrator routes. `pnpm check` passed without TypeScript errors, the regression suite passed 30 tests, and the production build completed successfully. The build retains its existing advisory warning for a large generated JavaScript chunk.

Returns-page and top-control QA — 2026-08-20: the public `/returns` route renders a non-transactional RMA-guidance page derived from Joan’s publicly accessible return form and terms, including the published 14-day withdrawal period at the appropriate “subject to applicable conditions” level. It links to the original full terms, real Joan support channels, and the new footer route. Desktop visual review confirmed the dark/red information hierarchy and three-step layout; 375×812 mobile review confirmed readable stacked actions and no horizontal overflow. A real browser test scrolled the page to 950px on desktop, displayed the labelled back-to-top button, activated it, and reached `scrollY: 0`; with a 375px mobile viewport and reduced motion enabled, the button reset 820px to `scrollY: 0` without requiring animated motion. TypeScript passed, 33 Vitest tests passed, and the production build completed successfully. The build retains its existing advisory warning for a large generated JavaScript chunk.

Returns and footer refinement QA — 2026-08-20: the footer’s return label is now an explicit `/returns` route rather than an inactive action, so it no longer invokes the payment-security notification. The public `/returns` page now contains five semantic FAQ disclosures; browser review opened “Каква информация трябва да подготвя?” without a route change and exposed its answer. Full-page desktop and 375px mobile screenshots confirmed the FAQ stack, the brighter footer copy against charcoal, the highlighted return link, and the blue icon-only Facebook link. The Facebook control exposes the accessible label “Facebook на ЖОАН”. TypeScript passed, all 36 Vitest tests passed, and the production build completed successfully. The build retains its existing advisory warning for a large generated JavaScript chunk.

Footer interaction follow-up — 2026-08-20: from the public `/contact` page, browser activation of the footer “Връщане” link navigated directly to `/returns`, without displaying the former payment-security toast. From the public return page, the icon-only Facebook control opened the official `https://www.facebook.com/www.joan.bg` destination and exposed the expected public Joan construction-hypermarket profile.

Mobile footer interaction follow-up — 2026-08-20: at an emulated 375px viewport, the icon-only Facebook footer link received keyboard focus, exposed its accessible label “Facebook на ЖОАН”, retained the official `https://www.facebook.com/www.joan.bg` destination, and opened that destination successfully on activation.
