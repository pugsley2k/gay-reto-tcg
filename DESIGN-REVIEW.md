# Storefront design review — 14 October 2026

Scope: visual review of the live home and shop, source review of home/shop/cart, and desktop/mobile browser checks of the revised public pages. This is not a checkout transaction, legal review, physical-phone test or performance benchmark.

## Assessment

The site now has a recognisable identity: cream script lettering, brick red, charcoal and prominent card artwork. The card fan is more memorable than a generic ecommerce hero. The weakest part is the transition from attractive artwork to a convincing, complete shop.

The visual design is roughly 7/10; the purchasing experience needs more work. These are editorial judgements, not automated scores. The deterministic Impeccable check on the homepage and shared footer returned no findings; that does not establish accessibility or usability across the whole site.

## Fixed in this pass

- Centered the footer logo in place of “Pokémon singles”; reused the same footer on home, shop and cart.
- Increased small factual text on homepage cards, carousel captions and shop filters/details.
- Preserved the selected card name when opening the shop from homepage arrivals.
- Connected filter labels to their controls; improved search placeholder contrast.
- Added keyboard opening, dialog semantics, focus containment, Escape dismissal and focus restoration to card details.
- Replaced the legacy multicolour shop loader with the brand colour and respected reduced motion.
- Removed pixelated rendering from cart images and the empty-cart duplicate divider.

## Priorities still to resolve

### P1 — Catalogue credibility

The public shop contains three Charizard listings with the same name and price, an explicitly marked example card, and missing condition information on some listings. These may be intentional individual copies, but shoppers cannot confidently distinguish them. The example is already blocked from checkout.

Before promoting the shop, review the actual inventory, confirm condition and edition for each copy, and make physical-copy differences clear. Hide the example from public stock once it is no longer useful. No inventory was changed during this review.

### P1 — Purchase confidence

The reviewed public pages do not give clear delivery, returns and contact information. The cart repeats subtotal and total without explaining delivery. Accurate information would help buyers more than additional decorative animation. The seller must supply the actual policies; do not invent shipping charges or promises.

### P2 — Showcase versus available stock

The large carousel is visually strong, but its artwork is not necessarily available to buy. Its small disclaimer does some work, and was enlarged in this pass. On a short desktop screen, the shop action falls below the initial viewport. Preserve the user-approved carousel, but consider an available-stock feature or a more immediately visible browse action as the catalogue grows.

### P2 — Filter vocabulary

“Holo Type” mixes finishes and rarity categories, with overlapping names such as “Holo Rare” and “Rare Holo”. This will become confusing with more stock. Normalize stored values and separate rarity from finish before expanding filtering. A cosmetic rename alone would hide the data problem.

### P3 — Style maintenance

Several CSS files retain successive generations of styles and appended overrides. They currently render the chosen theme, but make future changes fragile. Consolidate each public page into the final rules in a dedicated cleanup, with visual comparisons to avoid regressions.

## Buyer perspectives

A first-time visitor sees appealing artwork, but needs clearer reassurance about the real business and fulfilment. An experienced collector needs exact copy, edition, finish and condition information. A keyboard shopper previously could not open card images; that flow is now accessible by keyboard and returns focus after dismissal.

Recommended next order: accurate inventory, delivery/returns/contact information, then clearer product detail and normalized filters. Keep the established logo, palette and card-led presentation.
