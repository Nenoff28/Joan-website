
# Checkout address autocomplete refinement
- [x] Replaced the region and city/village selects with square searchable combobox inputs; typing filters Bulgarian options by prefix, such as „В“ and „Бе“.
- [x] Removed the „Изберете област“ and similar select options; the user now chooses from the filtered suggestions.
- [x] Kept automatic postcode filling after a settlement selection while allowing the postcode to be manually edited and limited to four digits.
- [x] Verified desktop/mobile presentation and interactive filtering/editing; 175 Vitest tests, TypeScript, production client+SSR build, and git diff --check passed.
