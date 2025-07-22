// app/api/card/scrape/route.ts
import { NextRequest } from 'next/server';

const POKE_API = 'https://api.pokemontcg.io/v2/cards';
const API_KEY  = process.env.POKEMON_API_KEY ?? '';   // leave blank if you don't have one

export async function GET(req: NextRequest) {
  /* ── 1. Read query params ─────────────────────────────────────────── */
  const url     = new URL(req.url);
  const name    = url.searchParams.get('name')?.trim()   ?? '';
  const number  = url.searchParams.get('number')?.trim() ?? '';

  if (!name || !number) {
    return new Response('Missing "name" or "number" query param.', { status: 400 });
  }

  /* ── 2. Call Pokémon‑TCG API ──────────────────────────────────────── */
  const query  = encodeURIComponent(`number:${number} name:"${name}"`);
  const res    = await fetch(`${POKE_API}?q=${query}`, {
    headers: { 'X-Api-Key': API_KEY },
    next:    { revalidate: 3600 }              // 1‑hour cache while in dev
  });

  if (!res.ok)
    return new Response('Upstream Pokémon‑TCG API error.', { status: 502 });

  const card = (await res.json()).data?.[0];
  if (!card)
    return new Response('Card not found.', { status: 404 });

  /* ── 3. Price handling ────────────────────────────────────────────── */
  const tcgPrices = card.tcgplayer?.prices;
  const rawPrice  =
        tcgPrices?.normal?.market ??
        tcgPrices?.holofoil?.market ??
        tcgPrices?.reverseHolofoil?.market ??
        null;

  // Convert £ → pence for your int4 column; default to 0 if unavailable
  const priceInPence = rawPrice !== null ? Math.round(rawPrice * 100) : 0;

  /* ── 4. Return JSON shaped EXACTLY like your Supabase "Card" table ── */
  return Response.json({
    // NOT‑NULL columns
    name:        card.name,           // text
    number:      card.number,         // text
    price:       priceInPence,        // integer (pence)
    set:         card.set.id,         // text
    image_url:   card.images.large,   // text
    available:   true,                // bool  (default in stock)

    // Nullable / optional columns
    rarity:      card.rarity ?? null, // text
    scan_url:    null,                // text – fill after you upload scans
    language:    'EN',                // text
    holo_type:   null                 // text – update if you care
  });
}
