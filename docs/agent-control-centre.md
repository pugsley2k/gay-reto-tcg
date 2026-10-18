# Seller Studio control centre — first release

Open `/admin/control` from Seller Studio. The same Clerk admin role protects the page and all management APIs.

## What works

- Inventory and payment checks run on demand, and through the existing daily Vercel cron. They use database rules, not model calls.
- Findings are saved, deduplicated and resolved only after a complete successful scan. Pausing prevents new checks; checkout protection remains active.
- A zero/invalid price or a sold listing still marked available creates a proposed withdrawal. Approval checks the exact listing version, expires after 24 hours and cannot hide stock held for checkout. Other findings link to manual inventory/order review.
- The activity history records checks and owner decisions. The database enforces a spending limit of zero; there are no advertising, subscription or purchasing tools.
- Existing manual scanner/assessment features are separate from these agents. No new paid services or model calls have been enabled. Existing hosting quotas and ordinary payment fees still apply.

## Checkout and stock

Each checkout reserves the physical cards for 15 minutes under database row locks. Browser retries reuse the same local and PayPal request identifiers. Prices, discounts and shipping are calculated on the server. An HttpOnly cookie binds the checkout to its originating browser.

Before capturing payment, the server verifies the PayPal order, amount, GBP currency and UK delivery address, then claims the reservation. A timeout is an unknown outcome: stock stays held until PayPal confirms the result. Captures retry with the same idempotency key within a conservative five-hour window; older unresolved payments require manual review. A completed capture finalises stock and queues one confirmation email atomically. Both callbacks and webhooks use the same verification and settlement functions.

Cancelled/expired unpaid reservations can be released or reclaimed. Capturing/review holds never expire automatically. Payment-review orders cannot dispatch or import into Click & Drop. Resolve the actual PayPal outcome and stock ownership before manually correcting these exceptional records; there is no automatic refund or stock-release button.

Anonymous and ordinary authenticated clients can read storefront listings and catalogue lookups but cannot change them. Inventory changes use admin server routes; reserved and sold stock has additional database checks. Old standalone maintenance scripts that use the anonymous Supabase key are no longer write-capable and are not used by agents.

## Card promo studio

The active workflow now automatically queues new listings and prepares an animated card advertisement from matching catalogue artwork, current price and the shop logo. Preview and export the MP4 in Seller Studio, then finish publishing in TikTok. It is independent of Suno. See [Card promo studio](card-promos.md) for the workflow and verification.

The older Suno draft-pack helper remains a legacy standalone utility and is no longer presented in the control centre.

## Release and verification

Apply `20261018183409_checkout_reservations.sql`, then `20261018183411_agent_control_centre.sql`, to the existing Supabase project immediately before releasing this application. Historical paid-card ownership is backfilled; overlapping historical paid orders deliberately abort migration for review. These migrations retain compatibility wrappers for the prior payment webhook. Do not roll back to the old checkout implementation or remove the stock constraints after taking new orders; use a forward fix.

No new environment variables are required. Existing server-only Supabase, PayPal, Clerk and cron configuration is reused. `SITE_URL` is the canonical checkout origin; production defaults to `https://www.gayretrotcg.com`.

Run `node --import tsx --test src/lib/*.test.ts`, `node --test tests/checkout-database.test.mjs`, and `npm run build`. Database tests use the free local PGlite PostgreSQL engine and cover reservation contention, expiry, uncertain captures, duplicate settlement, permissions, approval freshness and spending restrictions. PGlite serialises queries; true simultaneous production-session load testing is not claimed. Browser interaction tests use mock control-centre data, without live stock changes or a real PayPal charge.

Autonomous code changes, generated video and paid campaigns remain later phases. SEO and maintenance extend this release below.

## SEO and website maintenance release

The control centre now runs four rule-based agents: inventory, checkout, SEO and website maintenance. They use the existing daily cron (`0 9 * * *`, UTC), database and hosting. No paid model API, advertising, new subscription or extra scheduler is used. Existing infrastructure quotas still apply. Pause stops all routine agent checks; payment protection and order-email retry continue.

SEO checks five core pages and up to three real product pages, rotating the product sample daily. It reads server HTML for titles, descriptions, canonical URLs, noindex, H1 headings and product JSON-LD. It prepares exact title/description/canonical proposals for the five core pages. Approval also updates their social preview text. It does not promise rankings, collect search analytics or invent product claims.

Maintenance checks page responses, robots.txt, sitemap.xml and up to six whitelisted linked resources. It does not follow redirects, fetch external hosts, call checkout/admin endpoints, execute page JavaScript or inspect private customer data. Four requests run at a time, with a five-second request timeout, an eighteen-second crawl budget and a 512 KiB text limit. This is a sampled HTTP/HTML check, not an exhaustive crawl, browser performance test or security audit. Timeout findings explicitly ask for a retry before diagnosing downtime.

The generated sitemap updates with inventory and includes only public core pages and real available/sold products. Demo and unpublished products are excluded. Robots rules exclude application/private paths; robots.txt is not an access-control mechanism.

`web_agent_actions` is separate from inventory actions. Findings resolve only when that scope and page were successfully inspected. Failed SEO fetches and unsampled products keep earlier SEO findings. Dismissed identical proposals remain dismissed. The latest run stores coverage and failure status in `summary.web`.

Only an authenticated Clerk admin with a same-origin POST can decide actions. SEO approval re-reads live metadata, then a service-role-only SQL function locks the proposal and metadata row, checks the 24-hour expiry and revision, and publishes only the reviewed values. Repeat approvals are idempotent. The database validates page allowlists, fixed canonical origin and text lengths. Private tables have RLS and no anonymous/authenticated grants. No browser receives a service key.

The Published SEO metadata section offers a revision-bound restore to original metadata, with explicit confirmation and an activity entry. Restore removes that page's approved overrides; it does not change visible content. Maintenance findings are review requests, not executable deployment commands. Code, dependencies, design, URL redirects, database upgrades and paid work require a separately reviewed change. There is no automatic dependency updater or code-writing model in this release.

Validation: `npm run test:agents`, `node --import tsx --test src/lib/*.test.ts`, `npm run build`, then desktop/mobile control-centre review and an authenticated live check. The new migration is `20261018201035_seo_maintenance_agents.sql`; install it before deploying this release. The previous release remains compatible with these additive tables.
