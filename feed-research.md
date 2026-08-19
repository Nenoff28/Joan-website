# Live Product Feed Assessment

No catalog connector is configured for this project. Public search did not identify a documented Joan.bg product API or feed endpoint. The live Joan storefront does expose real category URLs in its navigation, including `https://joan.bg/строителни-материали/instrumenti`, `https://joan.bg/dom-i-gradina`, and `https://joan.bg/строителни-материали/stroitelstvo`.

The source site therefore supports an immediate reliable browsing route: the redesigned catalogue CTA can direct shoppers to the maintained live Joan catalogue rather than to a local representative catalogue. A first-party API or CSV/XML feed remains necessary to mirror live products, prices, and inventory inside this redesigned storefront without relying on unsupported scraping or cross-origin client requests.

The implemented bridge appears immediately after the homepage service strip and exposes four maintained external routes for tools, garden, construction, and promotions. Both the primary “Разгледайте каталога” control and the lower “Изберете категория” control target the bridge anchor; their event handler respects the visitor’s reduced-motion preference.
