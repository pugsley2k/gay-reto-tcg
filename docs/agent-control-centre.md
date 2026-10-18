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

## TikTok through the existing Suno uploader

1. Choose a card in the control centre and download its draft pack.
2. Record an MP4 of that actual card. The helper supports files up to 64 MB, matching the existing bridge limit.
3. Validate the pack and current stock without uploading:

   ```powershell
   node scripts/tiktok-draft.cjs --pack "C:\path\draft.json" --video "C:\path\card.mp4"
   ```

4. After confirming that the account currently connected to Suno is the intended shop account, send to its TikTok inbox:

   ```powershell
   node scripts/tiktok-draft.cjs --pack "C:\path\draft.json" --video "C:\path\card.mp4" --send --confirm-suno-account
   ```

The helper locates the existing `SunoPromo/tiktok_bridge.js` installation, or accepts `--bridge` with its exact path. Existing credentials remain in the desktop uploader. Its video-hash ledger prevents duplicate uploads. The helper checks stock and price immediately before invoking it; publishing later still requires checking availability. Packs expire after 24 hours.

This connection has `video.upload` inbox scope. Finish the post in TikTok. It does not provide unattended public posting, and no changes are made to Suno's music schedule. No content has been uploaded as part of this implementation.

## Release and verification

Apply `20261018183409_checkout_reservations.sql`, then `20261018183411_agent_control_centre.sql`, to the existing Supabase project immediately before releasing this application. Historical paid-card ownership is backfilled; overlapping historical paid orders deliberately abort migration for review. These migrations retain compatibility wrappers for the prior payment webhook. Do not roll back to the old checkout implementation or remove the stock constraints after taking new orders; use a forward fix.

No new environment variables are required. Existing server-only Supabase, PayPal, Clerk and cron configuration is reused. `SITE_URL` is the canonical checkout origin; production defaults to `https://www.gayretrotcg.com`.

Run `node --import tsx --test src/lib/*.test.ts`, `node --test tests/checkout-database.test.mjs`, and `npm run build`. Database tests use the free local PGlite PostgreSQL engine and cover reservation contention, expiry, uncertain captures, duplicate settlement, permissions, approval freshness and spending restrictions. PGlite serialises queries; true simultaneous production-session load testing is not claimed. Browser interaction tests use mock control-centre data, without live stock changes or a real PayPal charge.

SEO publishing, autonomous code changes, generated video and paid campaigns are later phases, not enabled agents in this release.
