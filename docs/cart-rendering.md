# Cart restoration and server rendering

`CartProvider` always renders its children. The server and first browser render use the same empty cart state; storage is read in an effect. Public pages, navigation, product details and customer information therefore arrive as HTML without waiting for JavaScript.

`isReady` gates cart-dependent controls. The cart page renders a heading, loading message, browse link and no-JavaScript notice until saved items and the gift code have been restored. Its form mounts after restoration, preserving the saved code in its input. Product add buttons and the Mew promotion wait for readiness. Payment capture on the return page also waits, so a fast confirmation cannot clear the cart before restoration and then have the old cart reappear. `clearCart` retains its stable callback identity.

Storage errors leave a working in-memory cart. Valid saved items survive damaged neighbouring entries, duplicate physical cards restore once, and restore is capped at the existing 100-item checkout limit. Stock checks run outside state updater functions, cancel on unmount and only remove items included in their original request. Network failures preserve the cart for authoritative server checkout validation. A delayed stock response cannot remove a newly added card.

No payment, inventory reservation, price validation or database function changed. No paid APIs or services were added. Checkout still requires JavaScript; this change makes public content server-rendered, not the PayPal flow. The shop's interactive search/results fetch remains unchanged.

## Verification

- `node --import tsx --test src/lib/*.test.ts` — library and payment tests.
- `node --test tests/checkout-database.test.mjs` — PostgreSQL/PGlite stock, settlement, permissions and agent approval checks.
- `npm run build`, then `npm run start -- --port 12010`.
- `npm run test:cart:browser` — ten isolated Playwright browser cases. It refuses non-local targets and mocks every checkout, payment-capture and cancellation request; no live card is reserved and no payment is charged.

Install a Playwright browser using `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=msedge` to use an already-installed Edge. `CART_TEST_URL` defaults to `http://localhost:12010`. Optional `CART_TEST_PRODUCT_PATH` adds a read-only no-JavaScript check for an existing public product. Optional `CART_TEST_SCREENSHOT` saves the no-JavaScript homepage view.

Browser coverage: public HTML with JavaScript disabled; delayed script loading; saved cart/promo restoration without empty-state writes; cart removal and checkout retry IDs; delayed and failed stock lookups; blocked storage; confirmed and uncertain payment returns; cancellation return; mobile totals and checkout. Tests also reject hydration and page exceptions, apart from known Clerk domain errors when production Clerk keys are used locally.
