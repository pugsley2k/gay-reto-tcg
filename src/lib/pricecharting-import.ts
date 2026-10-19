export function priceChartingItemUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 1000) throw new Error('Paste a PriceCharting Pokémon item link.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Paste a valid PriceCharting item link.'); }
  if (url.protocol !== 'https:' || !['www.pricecharting.com','pricecharting.com'].includes(url.hostname) || url.port || url.username || url.password || !/^\/game\/pokemon-[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(url.pathname)) throw new Error('Use an HTTPS PriceCharting Pokémon item page, not a search or marketplace link.');
  return `https://www.pricecharting.com${url.pathname.replace(/\/$/, '')}`;
}
export const isPriceChartingArtwork = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[a-zA-Z0-9_-]+\/(240|1600)\.jpg$/.test(value);
function text(html: string) {
  return html.replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|lt|gt|#39|#x27|nbsp);/gi, value => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '}[value.toLowerCase()] || ' ')).replace(/\s+/g,' ').trim();
}
export function parsePriceChartingItem(html: string, source: string) {
  const sourceUrl = priceChartingItemUrl(source);
  const heading = html.match(/<h1\b[^>]*\bid=["']product_name["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const set = heading?.match(/<a\b[^>]*href=["']\/console\/(pokemon-[a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!heading || !set || !sourceUrl.includes(`/game/${set[1]}/`)) throw new Error('This page does not contain a supported Pokémon card.');
  const identity = text(heading.split(/<a\b/i)[0]).match(/^(.+?)\s+#([A-Za-z0-9./-]+)$/);
  // Only the main product image qualifies. Never use thumbnails from sold listings.
  const cover = html.match(/<div\b[^>]*id=["']product_details["'][^>]*>[\s\S]*?<div\b[^>]*class=["']cover["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const images = cover.match(/<img\b[^>]*>/gi) || [];
  const image = images.find(tag => /itemprop=["']image["']/.test(tag))?.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!identity || identity[1].length > 200 || identity[2].length > 40 || !image || !isPriceChartingArtwork(image)) throw new Error('Could not find a card identity and catalogue image on this page. No listing was created.');
  const large = image.replace('/240.jpg','/1600.jpg');
  const priceCell=html.match(/<td\b[^>]*id=["']used_price["'][^>]*>([\s\S]*?)<\/td>/i)?.[1]||'';
  const quote=text(priceCell.match(/<span\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
  const amount=quote.match(/^([$£])([\d,]+(?:\.\d{1,2})?)$/);
  let price: number|null=null; let rate: number|null=null;
  if(amount){
    if(amount[1]==='£')rate=1;
    else if(/id=["']dropdown_selected_currency["']\s*>\s*USD\s*</.test(html)){
      try {const rates=JSON.parse(html.match(/VGPC\.forex_rates\s*=\s*(\{[^;]+\})\s*;/)?.[1]||'{}');if(typeof rates.GBP==='number'&&rates.GBP>0&&rates.GBP<10)rate=rates.GBP;}catch{/* Leave price empty rather than invent a conversion. */}
    }
    const converted=rate===null?null:Math.round(Number(amount[2].replaceAll(',',''))*rate*100);
    if(converted!==null&&Number.isSafeInteger(converted)&&converted>=30&&converted<=10000000)price=converted;
  }
  return { name: identity[1], number: identity[2], set: text(set[2]).replace(/^Pokemon\s+/i,''), image_url: html.includes(large) ? large : image, source_url: sourceUrl,
    price, price_note:price===null?'No reliable GBP price found. Enter your selling price manually.':`PriceCharting ungraded guide ${quote}${rate!==1?` converted using PriceCharting’s GBP rate ${rate}`:''}. Check condition and printing before selling.`, accessed_at:new Date().toISOString() };
}
export async function importPriceChartingItem(value: unknown, request: typeof fetch = fetch) {
  const url = priceChartingItemUrl(value);
  const response = await request(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});
  if (!response.ok) throw new Error('PriceCharting could not be read right now. Try again later or use manual listing.');
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('PriceCharting did not return an item page.');
  if (!response.body) throw new Error('PriceCharting returned an empty page.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size=0;
  try { while (true) { const {done,value:chunk}=await reader.read(); if(done)break; size+=chunk.length; if(size>1024*1024)throw new Error('The item page is too large to import.'); chunks.push(chunk); } }
  finally { await reader.cancel(); }
  return parsePriceChartingItem(Buffer.concat(chunks).toString('utf8'),url);
}
