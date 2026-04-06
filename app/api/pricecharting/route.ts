import { NextRequest, NextResponse } from 'next/server';

// Maps our holo type labels → PriceCharting search query modifier
const HOLO_MODIFIERS: Record<string, string> = {
  'Reverse Holo':               'reverse',
  'Pokeball Holo':              'reverse',
  'Master Ball Holo':           'reverse',
  'Cosmos Holo':                'reverse',
  'Holo Rare':                  'holo',
  'Rare Holo':                  'holo',
  'Rare Holo EX':               'holo',
  'Rare Holo GX':               'holo',
  'Rare Holo Lv.X':             'holo',
  'Rare Prime':                 'holo',
  'LEGEND':                     'holo',
  'Black White rare':           'holo',
  'Ultra Rare':                 'ultra-rare',
  'Double Rare':                'double-rare',
  'Full Art':                   'full-art',
  'Alt Art':                    'secret-rare',
  'Illustration Rare':          'illustration-rare',
  'Special Illustration Rare':  'special-illustration-rare',
  'Hyper Rare':                 'hyper-rare',
  'Mega Hyper Rare':            'hyper-rare',
  'Mega Attack Rare':           'hyper-rare',
  'Shiny Rare':                 'shiny-rare',
  'Shiny Ultra Rare':           'shiny-ultra-rare',
  'Radiant Rare':               'radiant',
  'Amazing':                    'amazing-rare',
  'ACE SPEC rare':              'ace-spec',
  'Rare BREAK':                 'break',
  'Promo':                      'promo',
};

// Maps our holo type labels → PriceCharting URL slug suffix
const PC_URL_SUFFIXES: Record<string, string> = {
  'Reverse Holo':               'reverse-holo',
  'Pokeball Holo':              'reverse-holo',
  'Master Ball Holo':           'reverse-holo',
  'Cosmos Holo':                'reverse-holo',
  'Holo Rare':                  'holofoil',
  'Rare Holo':                  'holofoil',
  'Rare Holo EX':               'holofoil',
  'Rare Holo GX':               'holofoil',
  'Rare Holo Lv.X':             'holofoil',
  'Rare Prime':                 'holofoil',
  'LEGEND':                     'holofoil',
  'Black White rare':           'holofoil',
  'Ultra Rare':                 'ultra-rare',
  'Double Rare':                'double-rare',
  'Full Art':                   'full-art',
  'Alt Art':                    'secret-rare',
  'Illustration Rare':          'illustration-rare',
  'Special Illustration Rare':  'special-illustration-rare',
  'Hyper Rare':                 'hyper-rare',
  'Mega Hyper Rare':            'hyper-rare',
  'Mega Attack Rare':           'hyper-rare',
  'Shiny Rare':                 'shiny-rare',
  'Shiny Ultra Rare':           'shiny-ultra-rare',
  'Radiant Rare':               'radiant',
  'Amazing':                    'amazing-rare',
  'ACE SPEC rare':              'ace-spec',
  'Rare BREAK':                 'break',
  'Promo':                      'promo',
};

const USD_TO_GBP = 0.79;
const STOP_WORDS = new Set(['pokemon', 'card', 'cards', 'the', 'of', 'a', 'and', '']);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractSetKeywords(setName: string): string[] {
  // Only the specific set name — NOT the series (drops noise like "scarlet violet")
  return [...new Set(
    setName
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOP_WORDS.has(w))
  )];
}

function buildSearchQuery(
  name: string, number: string, holoType: string,
  language: string, setName: string,
): string {
  const modifier = HOLO_MODIFIERS[holoType] ?? null;
  const langTag  = language === 'Japanese' ? 'japanese'
                 : language === 'Korean'   ? 'korean'
                 : null;
  const setKws   = extractSetKeywords(setName);
  return [name, modifier, number, 'pokemon', langTag, ...setKws]
    .filter(Boolean)
    .join(' ');
}

/**
 * Build direct product page URLs to try before falling back to search.
 * PC URL format: /game/pokemon-{set-slug}/{card-slug}-{suffix}
 * Returns multiple candidates (with suffix, without suffix) to try in order.
 */
function buildDirectUrls(
  name: string, holoType: string, language: string, setName: string,
): string[] {
  const langPrefix = language === 'Japanese' ? 'japanese-pokemon'
                   : language === 'Korean'   ? 'korean-pokemon'
                   : 'pokemon';
  const setSlug  = slugify(setName);
  const nameSlug = slugify(name);
  const suffix   = PC_URL_SUFFIXES[holoType];
  const base     = `https://www.pricecharting.com/game/${langPrefix}-${setSlug}`;
  const urls: string[] = [];
  if (suffix) urls.push(`${base}/${nameSlug}-${suffix}`);
  urls.push(`${base}/${nameSlug}`);   // no-suffix fallback (normal / base card)
  return urls;
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
  const imgMatch = html.match(
    /https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[a-f0-9]+\/\d+\.jpg/
  );
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

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // ── Step 1: Try direct URL construction (most reliable, no HTML parsing) ──
  const directUrls = buildDirectUrls(name, holoType, language, setName);
  for (const directUrl of directUrls) {
    try {
      const { html, finalUrl } = await fetchHtml(directUrl);
      if (finalUrl.includes('/game/')) {
        const { imageUrl, pricePence } = parseProductPage(html);
        if (imageUrl || pricePence) {
          return NextResponse.json({
            price: pricePence, image_url: imageUrl, url: finalUrl, not_found: false,
          });
        }
      }
    } catch (e: any) {
      if (e.status !== 404) break; // non-404 error = stop trying
      // 404 = card slug not found at this URL, try next candidate
    }
  }

  // ── Step 2: Fall back to search (handles edge cases / name variations) ──
  const query     = buildSearchQuery(name, number, holoType, language, setName);
  const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;

  try {
    const { html: html1, finalUrl: url1 } = await fetchHtml(searchUrl);

    let productHtml: string;
    let productUrl:  string;

    if (url1.includes('/game/')) {
      productHtml = html1;
      productUrl  = url1;
    } else {
      // Search results may be JS-rendered; try broader link pattern
      const linkMatch = html1.match(/href="(\/game\/(?:pokemon|japanese-pokemon|korean-pokemon)[^"]+)"/);
      if (!linkMatch) {
        return NextResponse.json({ price: null, image_url: null, url: searchUrl, not_found: true });
      }
      const { html: html2, finalUrl: url2 } = await fetchHtml(`https://www.pricecharting.com${linkMatch[1]}`);
      productHtml = html2;
      productUrl  = url2;
    }

    const { imageUrl, pricePence } = parseProductPage(productHtml);

    return NextResponse.json({
      price: pricePence, image_url: imageUrl, url: productUrl, not_found: false,
    });

  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    if (e.status === 404) {
      return NextResponse.json({ price: null, image_url: null, url: searchUrl, not_found: true });
    }
    return NextResponse.json({ error: e.message ?? 'Unknown error', price: null, image_url: null, url: searchUrl });
  }
}
