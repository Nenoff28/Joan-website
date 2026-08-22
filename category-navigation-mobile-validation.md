# Category Navigation and Mobile Validation

The public catalogue now derives its visible subcategory controls from the imported OpenCart category hierarchy rather than a stale static label set. This keeps each clickable path aligned with the exact category rows used by server-side product filtering.

The category page now memoizes every page/filter query input, resets page and filter-panel route state before cross-category navigation, and removes prior-category placeholder data while the newly selected category loads. This prevents a subcategory selection or category switch from retaining stale results.

At a 375 px viewport, the checked **Инструменти → Електроинструменти → Бормашини**, **Баня → Вани и профили → Душ кабини**, and **Градина** routes render their own hero and hierarchy state. Mobile hierarchy rows use larger tap targets, while long leaf labels are horizontally scrollable rather than compressed. Listing tools and pagination use full-width, touch-friendly controls.

The final exact URL checks rendered **18** active products for **Бормашини** and **4** active products for **Душ кабини**. The latter was also checked visually in the mobile catalogue, showing the linked shower-cabin product cards and EUR prices beneath the selected path.
