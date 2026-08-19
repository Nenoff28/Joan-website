# Extended Storefront QA Notes

The enhanced RTRMAX product page renders the compliant review area with an explicit verified-feedback empty state and no fabricated customer content. It renders the recommended-product rail, exposes a direct checkout route for the priced product, and switches the operational header, product-decision controls, review section, recommendations, and checkout labels from Bulgarian to English through the BG/EN control. Product names and source-backed descriptions remain in their original catalogue language.

The English mock checkout opens with the selected RTRMAX product, quantity, accurate representative price, and a prominent non-payment disclosure. Submitting the blank form exposes field-level validation messages for contact information, delivery address, postcode, and the mandatory demonstration acknowledgement without navigating away or creating an order.

The successful-path test uses non-sensitive demonstration values only. Once the acknowledgement checkbox is selected, all client-side constraints are satisfied and the simulated submission can be completed without transmitting data.

The mobile product page preserves the compact operational spec strip, truthful review state, recommendation cards, and checkout entry. The mobile checkout keeps the contact and delivery fields, non-payment notice, order summary, and request-confirmation action legible without horizontal overflow.
