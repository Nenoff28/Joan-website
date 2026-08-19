# Joan.bg — Design Direction

## Three Initial Approaches

### 1. Red Workshop Modernism
**Very Brief Intro:** A purposeful, confident retail system that combines practical construction-site clarity with finely controlled editorial typography. It feels dependable and premium rather than decorative.

**Probability:** 0.07

### 2. Quiet Material Library
**Very Brief Intro:** A calm, tactile direction inspired by materials, specification books, and architectural showrooms. Neutral surfaces dominate while a highly disciplined red guides decisions and conversion.

**Probability:** 0.04

### 3. Storefront Gridline
**Very Brief Intro:** A high-density digital retail environment with robust navigation, restrained graphic structure, and visual cues borrowed from professional trade catalogs. Its energy comes from hierarchy and utility, not visual noise.

**Probability:** 0.09

---

## Chosen Direction — Red Workshop Modernism

### Design Movement
**Contemporary industrial modernism**: the ordering, directness, and material honesty of European trade catalogs refined with the clean information hierarchy of modern premium commerce.

### Core Principles
1. **Findability before flourish:** Search, category routes, product availability, and prices are visually primary.
2. **Red with intent:** Joan red signals action, status, and active selection; it is never used as a broad page fill.
3. **Tactile restraint:** Warm off-white, graphite, subtle shadows, and hairline rules evoke practical material quality without skeuomorphism.
4. **Dense but breathable:** Clear groupings, strong type scale, and deliberate rhythm accommodate a wide catalog without overwhelming visitors.

### Color Philosophy
The site is predominantly **stone white, light mineral gray, and graphite**, creating a neutral, trustworthy retail field in which products remain the visual subject. A saturated but grounded **Joan Signal Red** anchors primary actions and promotional markers, supported by dark red for pressure states. Success, warning, and error colors are reserved for operational information such as availability and service states.

### Layout Paradigm
The interface is organized as a **retail workbench**: a compact utility rail, a search-forward operational header, an edge-to-edge category rail, then alternating full-bleed campaign fields and structured product bays. Content intentionally aligns to firm vertical anchor lines rather than relying on one centered-card composition.

### Signature Elements
- **Signal rails:** thin Joan-red bands, underlines, and edge markers identify selection, promotions, and active paths.
- **Product spec strips:** understated metadata lines and availability chips read like a reliable supplier catalog.
- **Cut-corner labels:** small angular brand labels and category tags reference construction material marks without turning every container into a rounded card.

### Interaction Philosophy
Interactions should feel engineered, direct, and reversible. Hovering reveals secondary choices, search suggestions appear rapidly, and mobile navigation focuses on one clear decision at a time. Buttons provide immediate visual feedback, while noncritical enhancement remains subtle.

### Animation
Use 120–220ms transforms and opacity transitions with a crisp cubic-bezier ease-out. Navigation panels and mobile drawers move from their trigger edges; product cards lift by only a few pixels on hover. Avoid looping decorative animation. Respect `prefers-reduced-motion` by removing nonessential entrances and keeping state changes instant.

### Typography System
**Manrope** is used for bold, geometric headings, navigational labels, prices, and important operational data. **IBM Plex Sans** carries product descriptions, long-form information, and form controls. Both fonts must be loaded with Cyrillic support. Headings are compact and assertive; product names prioritize scanability; prices use heavier weights with tabular numbers where possible.

### Brand Essence
**Joan is the dependable Bulgarian destination for construction and home-improvement products, built around fast discovery and clear, practical choices.**

**Personality:** capable, direct, grounded.

### Brand Voice
Headlines are concise and useful; CTAs name the next action plainly; microcopy resolves uncertainty rather than filling space.

> "Всичко за ремонта, на едно място."

> "Открий продукти по категория, марка или код."

### Wordmark & Logo
The Joan mark is a confident red **J** constructed from a vertical steel-like bar and a squared, forward-facing hook, paired with a compact, custom-cut JOAN wordmark. The app/favicon version uses the symbol alone in a red field or on transparent ground.

### Signature Brand Color
**Joan Signal Red — #D71920**

## Style Decisions

- Joan Signal Red appears primarily on actions, promotional and status markers, active navigation, price emphasis, and thin signal rails. Full red fields are reserved for rare brand-campaign moments only.
- Every major page includes at least one Joan catalog motif: a signal rail, product specification strip, cut-corner label, or rule-based workbench grid.
- Imagery is treated as practical and material-led, emphasizing tools, surfaces, store context, and trade-use texture rather than generic lifestyle showroom aesthetics.
- Product cards and detail pages visibly pair a red signal rail with compact operational metadata for price, availability, and key attributes.
- Customer-facing purchase guidance reads as an operational request flow; prototype constraints are isolated in a clear technical notice rather than repeated as primary marketing copy.
- The red Joan J and custom JOAN wordmark remain primary. The legacy yellow store badge is a subdued secondary heritage stamp only.
- Joan Signal Red is the sole warm visual emphasis; hero type remains neutral while red communicates actions, rails, status, and promotion.
- Homepage category and product modules use numbering, red edge rails, compact operating metadata, and hairline dividers to reinforce the trade-catalog system.
- Every homepage module carries a retail utility signal—category route, availability/service cue, location cue, price/product cue, or compact catalog metadata.
- Editorial and support blocks reuse the same workbench grammar: red signal rails, indexed bays, hairline dividers, compact facts, and direct operational copy.
