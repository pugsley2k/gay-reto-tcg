import { NextRequest, NextResponse } from 'next/server';

const HOLO_MODIFIERS: Record<string, string> = {
  'Reverse Holo':               'reverse',
  'Pokeball Holo':              'reverse',
  'Master Ball Holo':           'reverse',
  'Cosmos Holo':                'reverse',
  'Holo Rare':                  'holo',
  'Full Art':                   'full-art',
  'Alt Art':                    'secret-rare',
  'Special Illustration Rare':  'special-illustration-rare',
  'Hyper Rare':                 'hyper-rare',
  'Double Rare':                'double-rare',
  'Ultra Rare':                 'ultra-rare',
  'Promo':                      'promo',
};

const USD_TO_GBP = 0.79;
const STOP_WORDS = new Set(['pokemon', 'card', 'cards', 'the', 'of', 'a', 'and', '']);

function extractSetKeywords(setName: string, setSeries: string): string[] {
  const combined = `${setSeries} ${setName}`
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w));
  return [...new Set(combined)];
}

/**
 * Builds a search query specific enough to auto-redirect to the correct
 * PriceCharting product page.
 * e.g. "scyther reverse 123 pokemon japanese scarlet violet 151"
 */
function buildSearchQuery(
  name: string, number: string, holoType: string,
  language: string, setName: string, setSeries: string,
): string {
  const modifier = HOLO_MODIFIERS[holoType] ?? null;
  const langTag  = language === 'Japanese' ? 'japanese'
                 : language === 'Korean'   ? 'korean'
                 : null;
  const setKws   = extractSetKeywords(setName, setSeries);
  return [name, modifier, number, 'pokemon', langTag, ...setKws]
    .filter(Boolean)
    .join(' ');
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  const status = res.status;
  if (status === 404) throw Object.assign(new Error('Not found'), { status: 404 });
  if (!res.ok)        throw Object.assign(new Error(`HTTP ${status}`), { status });
  return { html: await res.text(), finalUrl: res.url };
}

function parseProductPage(html: string) {
  // Card image hosted on Google Cloud Storage
  const imgMatch = html.match(
    /https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[a-f0-9]+\/\d+\.jpg/
  );
  // Ungraded (loose) price from <td id="used_price">$2.54 +$0.12</td>
  const section  = html.match(/id="used_price"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '';
  const usdMatch = section.match(/\$([\d,]+\.?\d*)/);
  const usdPrice = usdMatch ? parseFloat(usdMatch[1].replace(',', '')) : null;
  return {
    imageUrl:   imgMatch ? imgMatch[0] : null,
    pricePence: usdPrice !== null ? Math.round(usdPrice * USD_TO_GBP * 100) : null,
  };
}

export async function GET(req: NextRequest) {
  const sp        = new URL(req.url).searchParams;
  const name      = sp.get('name')       ?? '';
  const number    = sp.get('number')     ?? '';
  const holoType  = sp.get('holo_type')  ?? '';
  const language  = sp.get('language')   ?? 'English';
  const setName   = sp.get('set_name')   ?? '';
  const setSeries = sp.get('set_series') ?? '';

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const query     = buildSearchQuery(name, number, holoType, language, setName, setSeries);
  const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;

  try {
    // Step 1 — fetch search page (may auto-redirect to product page via HTTP redirect)
    const { html: html1, finalUrl: url1 } = await fetchHtml(searchUrl);

    let productHtml: string;
    let productUrl:  string;

    if (url1.includes('/game/')) {
      // Single-result: PriceCharting redirected straight to the product page
      productHtml = html1;
      productUrl  = url1;
    } else {
      // Multiple results: extract first /game/pokemon link and follow it
      const linkMatch = html1.match(/href="(\/game\/pokemon[^"]+)"/);
      if (!linkMatch) {
        return NextResponse.json({ price: null, image_url: null, url: searchUrl, not_found: true });
      }
      const { html: html2, finalUrl: url2 } = await fetchHtml(`https://www.pricecharting.com${linkMatch[1]}`);
      productHtml = html2;
      productUrl  = url2;
    }

    const { imageUrl, pricePence } = parseProductPage(productHtml);

    return NextResponse.json({
      price:     pricePence,   // GBP pence
      image_url: imageUrl,
      url:       productUrl,
      not_found: false,
    });

  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    if (e.status === 404) {
      return NextResponse.json({ price: null, image_url: null, url: searchUrl, not_found: true });
    }
    return NextResponse.json({ error: e.message ?? 'Unknown error', price: null, image_url: null, url: searchUrl });
  }
}
