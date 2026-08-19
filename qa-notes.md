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
