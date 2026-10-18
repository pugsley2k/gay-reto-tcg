import { readGrading, type Grading } from './card-grading';
import { gradedPrice,type PriceComparison } from './graded-pricing';
export type CatalogCard = {
  id: string; name: string; localId: string; rarity?: string; image?: string; illustrator?:string;
  set: { name: string; cardCount: { official: number } };
  variants?: { normal?: boolean; holo?: boolean; reverse?: boolean; firstEdition?: boolean };
  pricing?: { cardmarket?: { updated: string; unit: string; trend?: number; 'trend-holo'?: number; 'trend-reverse'?: number }; tcgplayer?: { unit: string; updated: string; normal?: { marketPrice?: number }; holofoil?: { marketPrice?: number; productId?: number }; reverseHolofoil?: { marketPrice?: number }; [variant: string]: unknown } };
};
export type ScanIdentity = { name: string; original_name?: string; number: string; total?: string; language: string; finish?: string | null; edition?: string | null; grading?: Grading | null };
export const normaliseName = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const normaliseNumber = (value: string) => value.toUpperCase().replace(/^0+(?=\d)/, '');
const familyName = (value: string) => value.replace(/\s*(?:ex|gx|vmax|vstar|v|break)\s*$/i, '').trim();
function matchesName(name: string, scan: ScanIdentity) {
  const printed = scan.language === 'English' ? scan.name : scan.original_name;
  return !!printed && (normaliseName(name) === normaliseName(printed) || (!!scan.total && normaliseName(familyName(name)) === normaliseName(familyName(printed))));
}
export function matchesCard(card: CatalogCard, scan: ScanIdentity) {
  const name = scan.language === 'English' ? scan.name : scan.original_name;
  // E-reader holos have a separate H1–H32 sequence, not the main set total.
  const holoSubset = /^ecard[123]-H(?:[1-9]|[12]\d|3[0-2])$/.test(card.id) && /^(?:H)?32$/i.test(scan.total || '') && /^H/i.test(scan.number);
  return !!name && matchesName(card.name, scan) && normaliseNumber(card.localId) === normaliseNumber(scan.number)
    && (!scan.total || holoSubset || Number(scan.total) === card.set.cardCount.official);
}
export function resolveFinish(card: CatalogCard, detected?: string | null) {
  const variants = card.variants;
  if (detected === 'Reverse Holo' && variants?.reverse) return 'Reverse Holo';
  if (variants?.normal && !variants.holo && !variants.reverse) return 'Normal';
  if (variants?.holo && !variants.normal && !variants.reverse) return 'Holo Rare';
  if (detected === 'Normal' && variants?.normal) return 'Normal';
  if (detected === 'Holo Rare' && variants?.holo) return 'Holo Rare';
  return null;
}
export function resolveCatalogEdition(card:CatalogCard,scan:Pick<ScanIdentity,'edition'|'language'>){
 if(card.variants?.firstEdition&&scan.edition==='Not applicable')return null;
 // English e-reader sets have no 1st Edition variant. This is catalogue-backed,
 // not an inference from glare or an unreadable stamp area in a photo.
 if(!scan.edition&&scan.language==='English'&&/^ecard[123]-/.test(card.id)&&card.variants?.firstEdition===false)return 'Not applicable';
 return scan.edition||null;
}
export function marketQuote(card: CatalogCard, finish: string | null, edition?: string | null) {
  if (!finish) return null;
  const tcg = card.pricing?.tcgplayer;
  const editionSensitive = !!card.variants?.firstEdition || edition === '1st Edition' || edition === 'Unlimited';
  if (editionSensitive && edition !== '1st Edition' && edition !== 'Unlimited') return null;
  const editionKey = edition === '1st Edition' ? (finish === 'Normal' ? '1st-edition' : finish === 'Holo Rare' ? '1st-edition-holofoil' : '') : (finish === 'Normal' ? 'unlimited' : finish === 'Holo Rare' ? 'unlimited-holofoil' : '');
  const specific = editionKey ? tcg?.[editionKey] as { marketPrice?: number } | undefined : undefined;
  // TCGplayer product 42382 is the standard Base Set Charizard listing,
  // distinct from its Shadowless/1st Edition products. The feed calls it holofoil.
  const standardUnlimitedCharizard = edition === 'Unlimited' && finish === 'Holo Rare' && card.id === 'base1-4' && tcg?.holofoil?.productId === 42382;
  const variant = editionSensitive ? specific || (standardUnlimitedCharizard ? tcg?.holofoil : undefined) : finish === 'Reverse Holo' ? tcg?.reverseHolofoil : finish === 'Normal' ? tcg?.normal : tcg?.holofoil;
  if (tcg?.unit === 'USD' && Number.isFinite(variant?.marketPrice) && variant!.marketPrice! > 0) return { amount: variant!.marketPrice!, currency: 'USD', source: 'TCGplayer market via TCGdex', updated: tcg.updated };
  if (editionSensitive) return null; // General trends do not establish the edition.
  const cm = card.pricing?.cardmarket;
  // The general trend can describe the non-holo even on an H-numbered page.
  // Require the finish-specific field for both holo and reverse-holo quotes.
  const amount = finish === 'Reverse Holo' ? cm?.['trend-reverse'] : finish === 'Normal' ? cm?.trend : cm?.['trend-holo'];
  if (cm?.unit === 'EUR' && Number.isFinite(amount) && amount! > 0) return { amount: amount!, currency: 'EUR', source: 'Cardmarket trend via TCGdex', updated: cm.updated };
  return null;
}
async function catalogFetch(path: string) {
  const response = await fetch(`https://api.tcgdex.net/v2/${path}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Catalogue unavailable');
  return response.json();
}
const languages: Record<string,string> = { English: 'en', Japanese: 'ja', Korean: 'ko' };
export function catalogImageUrl(card: CatalogCard, language: string) {
  const lang = languages[language];
  if (!lang || !card.image || !new RegExp(`^https://assets\\.tcgdex\\.net/${lang}/[A-Za-z0-9/_-]+$`).test(card.image)) return null;
  return `${card.image.replace(/\/$/, '')}/high.webp`;
}
async function availableImage(card: CatalogCard, language: string) {
  const url = catalogImageUrl(card, language);
  if (!url) return null;
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'error', next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });
    return response.ok && response.headers.get('content-type')?.startsWith('image/') ? url : null;
  } catch { return null; }
}
export async function enrichCard(scan: ScanIdentity, selectedId?: string) {
  const lang = languages[scan.language];
  if (!lang || !scan.number || !scan.name) return { matched: false, notice: 'Check the card name and number to look up its set.' };
  let candidates: CatalogCard[];
  if (selectedId) {
    const card = await catalogFetch(`${lang}/cards/${encodeURIComponent(selectedId)}`) as CatalogCard;
    candidates = matchesCard(card, { ...scan, total: undefined }) ? [card] : [];
  } else {
    const query = new URLSearchParams({ name: familyName(scan.language === 'English' ? scan.name : scan.original_name || scan.name), localId: scan.number, 'pagination:page': '1', 'pagination:itemsPerPage': '30' });
    const list = await catalogFetch(`${lang}/cards?${query}`) as {id:string;name:string;localId:string}[];
    const exact = list.filter(c => normaliseNumber(c.localId) === normaliseNumber(scan.number) && matchesName(c.name, scan));
    if (exact.length > 12) return { matched: false, notice: 'Too many printings match. Check the scanned name and number before looking up again.' };
    const results = await Promise.allSettled(exact.slice(0, 12).map(c => catalogFetch(`${lang}/cards/${encodeURIComponent(c.id)}`)));
    if (results.some(r => r.status === 'rejected')) return { matched: false, notice: 'Some catalogue results could not load. Retry the lookup before choosing a printing.' };
    candidates = results.filter((r): r is PromiseFulfilledResult<CatalogCard> => r.status === 'fulfilled').map(r => r.value).filter(c => matchesCard(c, scan));
  }
  if (candidates.length !== 1) return { matched: false, candidates: candidates.map(c=>({ id:c.id, name:c.name, set:c.set.name, number:c.localId, rarity:c.rarity })), notice: candidates.length ? 'More than one printing fits. Choose the set shown on your card.' : 'No exact catalogue match. You can enter the details manually.' };
  const card = candidates[0];
  const finish = resolveFinish(card, scan.finish);
  const rarity = card.rarity || '';
  const holo = /illustration|ultra|double|hyper|shiny|radiant/i.test(rarity) ? rarity.replace(/\b\w/g, c=>c.toUpperCase()) : finish;
  const result = { matched: true, image_url: card.variants?.firstEdition || scan.edition === '1st Edition' ? null : await availableImage(card, scan.language), edition: resolveCatalogEdition(card,scan), name: scan.language === 'English' ? card.name : scan.name, catalog_id: card.id, illustrator:card.illustrator||null, set: card.set.name, rarity, holo_type: holo, pricing: null as null | { gbp: string; source: string; updated: string; original: number; currency: string; rate: number; rate_date: string }, notice: finish ? 'Catalogue match found. Check the artwork and condition before publishing.' : 'Set and rarity found. Confirm the finish before requesting a price.' };
  if (card.variants?.firstEdition || scan.edition === '1st Edition') result.notice += result.edition === '1st Edition' || result.edition === 'Unlimited' ? ` Edition: ${result.edition}. Your photo will be used to show the actual printing.` : ' Choose 1st Edition or Unlimited before requesting a price.';
  if (card.id === 'base1-4' && result.edition === 'Unlimited') result.notice += ' Unlimited pricing refers to the standard shadowed printing, not Shadowless or 1999–2000 variants.';
  const grading = readGrading(scan.grading);
  if (grading) {
    result.image_url = null;
    const graded = await gradedPrice({name:result.name,number:card.localId,set:result.set,language:scan.language,edition:result.edition||'',finish:result.holo_type||''},grading);
    const comparisons:PriceComparison[]=[...(graded.comparisons||[])];
    if(!comparisons.some(item=>item.url===`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(card.id)}`)){
     const raw=marketQuote(card,finish,result.edition);const age=raw?Date.now()-Date.parse(raw.updated):Infinity;
     if(raw&&Number.isFinite(age)&&age>= -86400000&&age<=30*86400000)try{
      const response=await fetch(`https://api.frankfurter.dev/v1/latest?base=${raw.currency}&symbols=GBP`,{next:{revalidate:86400},signal:AbortSignal.timeout(6000)});
      if(response.ok){const fx=await response.json();const age=Date.now()-Date.parse(fx.date);if(Number.isFinite(fx.rates?.GBP)&&fx.rates.GBP>0&&Number.isFinite(age)&&age<=7*86400000&&age>= -86400000)comparisons.push({gbp:(Math.round(raw.amount*fx.rates.GBP*100)/100).toFixed(2),source:`Ungraded reference · ${raw.source}`,updated:raw.updated,original:raw.amount,currency:raw.currency,rate_date:fx.date,url:`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(card.id)}`,company:'Ungraded',grade:'ungraded',basis:'guide'});}
     }catch{/* A missing raw benchmark must not block a slab listing. */}
    }
    return {...result,...graded,comparisons};
  }
  const quote = marketQuote(card, finish, result.edition);
  if (!quote) { result.notice += ' No reliable price is available for this printing and edition.'; return result; }
  const age = Date.now() - Date.parse(quote.updated);
  if (!Number.isFinite(age) || age > 30 * 86400000 || age < -86400000) { result.notice += ' Pricing data is out of date; enter your own price.'; return result; }
  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${quote.currency}&symbols=GBP`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('Conversion unavailable');
    const fx = await response.json();
    const rate = fx.rates?.GBP;
    if (!Number.isFinite(rate) || rate <= 0 || !fx.date || Date.now() - Date.parse(fx.date) > 7 * 86400000) throw new Error('Invalid conversion');
    result.pricing = { gbp: (Math.max(1, Math.round(quote.amount * rate * 100)) / 100).toFixed(2), source: quote.source, updated: quote.updated, original: quote.amount, currency: quote.currency, rate, rate_date: fx.date };
  } catch { result.notice += ' Currency conversion is unavailable; enter a GBP price.'; }
  return result;
}
