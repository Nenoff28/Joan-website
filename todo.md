
# Catalogue-wide product image background refinement
- [x] Apply a high-specificity global override so `/products`, category listings, related-product cards, homepage product shelves, and detail galleries all use a clean white image surface.
- [x] Disable every catalogue image-area `background-image` grid with `!important`, including the workbench-specific and related-section rules that previously overrode the first fix.
- [x] Keep complete-image rendering with `object-fit: contain` for catalogue, related, and detail product images.
- [x] Verify `/products` at desktop and mobile sizes; 50 Vitest files / 176 tests, TypeScript, production client+SSR build, and `git diff --check` passed.
