# PriceCharting link import

Seller Studio → Manual listing → Import from PriceCharting link. Paste an HTTPS Pokémon item URL and choose Import card details. It fills the name, card number, set, main catalogue artwork and ungraded guide price in whole GBP pence. It does not create stock until the owner reviews the fields, selects language, condition and finish, checks the confirmation and chooses Add card. No photo is required. Imported artwork stays separate from an optional front photograph.

Only the item's own cover image in the specific `images.pricecharting.com` Google Storage bucket is accepted. Marketplace seller photos and unrelated URLs are excluded. Shop artwork and both promo renderers accept that exact image path format. The PC worker must restart after an update to load its new artwork allowlist.

The price uses `used_price` (ungraded), not graded bands, sale rows or price changes. If the HTML contains USD, convert with PriceCharting's own embedded GBP rate; display the original quote and rate beside the import. A direct GBP guide needs no conversion. Missing or invalid price/currency evidence leaves price empty, never zero or a guessed rate. Prices are a snapshot at import and editable, not continuously synchronised. No paid AI, API or new subscription is used.

The import endpoint is admin-only, same-origin, no-store, allowlists the canonical PriceCharting HTTPS item host/path, refuses redirects and bounds response size (1 MiB) and time (12 seconds). If PriceCharting blocks or changes its page, the importer shows an error and creates nothing. The existing authenticated inventory endpoint validates and saves the reviewed listing; imported listings carry a stable client UUID to make identical save retries idempotent.
