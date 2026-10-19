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
function finishFrom(value: string) {
  for(const [pattern,label] of [
    [/\bspecial illustration rare\b/i,'Special Illustration Rare'],[/\billustration rare\b/i,'Illustration Rare'],
    [/\bmaster\s*ball\b/i,'Master Ball Holo'],[/\bpoke\s*ball\b/i,'Pokeball Holo'],
    [/\breverse(?: holo(?:foil)?)?\b/i,'Reverse Holo'],[/\bnon[- ]?holo(?:foil)?\b|\bnormal\b/i,'Normal'],
    [/\b(?:alternate|alt) art\b/i,'Alt Art'],[/\bfull art\b/i,'Full Art'],[/\bhyper rare\b/i,'Hyper Rare'],
    [/\bultra rare\b/i,'Ultra Rare'],[/\bholo(?:foil|graphic)?\b/i,'Holo'],
  ] as const)if(pattern.test(value))return label;
  return null;
}
function languageFrom(value: string) {
  for(const language of ['English','Japanese','Korean'] as const)if(new RegExp(`\\b${language}\\b`,'i').test(value))return language;
  return null;
}
export function priceChartingSuggestions(html:string, name:string, number:string, setName:string, productHeading:string) {
  const normal=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const numberPattern=new RegExp(`(?:^|[^a-z0-9])0*${number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:[^a-z0-9]|$)`,'i');
  // Sale descriptions are suggestions, not catalogue guarantees. Require matching
  // card identity and agreement across at least three distinct descriptions.
  const titles=[...new Set([...html.matchAll(/<a\b[^>]*class=["'][^"']*\bjs-ebay-completed-sale\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match=>text(match[1])))].filter(title=>normal(title).includes(normal(name.replace(/\[[^\]]*\]/g,'')))&&normal(title).includes(normal(setName))&&numberPattern.test(title));
  function consensus<T extends string>(values:(T|null)[]) {const known=values.filter((v):v is T=>v!==null);return known.length>=3&&new Set(known).size===1?known[0]:null;}
  const language=languageFrom(productHeading)||consensus(titles.map(languageFrom));
  const finishes=titles.map(finishFrom);
  const specific=finishes.filter(value=>value&&value!=='Holo');
  // "Holo" is compatible with a more specific holographic rarity, but Normal
  // versus Holo, or competing named variants, must still require manual review.
  const candidates=(specific.length>=3&&!specific.includes('Normal')?specific:finishes).filter((v):v is NonNullable<typeof v>=>v!==null);
  const counts=[...new Set(candidates)].map(value=>({value,count:candidates.filter(item=>item===value).length})).sort((a,b)=>b.count-a.count);
  const dominant=counts[0];
  const finish=finishFrom(productHeading)||(dominant&&dominant.count>=3&&dominant.count/candidates.length>=0.85?dominant.value:null);
  return {language,holo_type:finish,details_note:language||finish?'Language and finish are suggestions from PriceCharting’s product heading or matching sale descriptions. Check them against your card before approving.':'PriceCharting did not clearly identify language or finish. Choose the missing details before approving.'};
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
  const setName=text(set[2]).replace(/^Pokemon\s+/i,'');
  const suggestions=priceChartingSuggestions(html,identity[1],identity[2],setName,text(heading));
  return { name: identity[1], number: identity[2], set: setName, ...suggestions, image_url: html.includes(large) ? large : image, source_url: sourceUrl,
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
