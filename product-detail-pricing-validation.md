# Product Detail Price Presentation Validation

The public product-detail styling now suppresses the internal `PDP—01` implementation marker.

For standard-price products, the price heading is **Цена** in Bulgarian and **Price** in English. The heading changes to **Промоционална цена** only when the product has a verified `oldPriceEur` value, in which case the previous EUR price is also displayed.

Desktop verification checked one normal-price product and one genuine promotional product. Mobile verification checked a concise normal-price product and confirmed the product page begins without any `PDP—01` marker.
