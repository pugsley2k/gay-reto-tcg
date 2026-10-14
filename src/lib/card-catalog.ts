export type CatalogCard = {
  id: string; name: string; localId: string; rarity?: string;
  set: { name: string; cardCount: { official: number } };
  variants?: { normal?: boolean; holo?: boolean; reverse?: boolean };
  pricing?: { cardmarket?: { updated: string; unit: string; trend?: number; 'trend-holo'?: number; 'trend-reverse'?: number }; tcgplayer?: { unit: string; updated: string; normal?: { marketPrice?: number }; holofoil?: { marketPrice?: number }; reverseHolofoil?: { marketPrice?: number } } };
};
export type ScanIdentity = { name: string; original_name?: string; number: string; total?: string; language: string; finish?: string | null };
export const normaliseName = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const normaliseNumber = (value: string) => value.toUpperCase().replace(/^0+(?=\d)/, '');
export function matchesCard(card: CatalogCard, scan: ScanIdentity) {
  const name = scan.language === 'English' ? scan.name : scan.original_name;
  return !!name && normaliseName(card.name) === normaliseName(name) && normaliseNumber(card.localId) === normaliseNumber(scan.number)
    && (!scan.total || Number(scan.total) === card.set.cardCount.official);
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
export function marketQuote(card: CatalogCard, finish: string | null) {
  if (!finish) return null;
  const tcg = card.pricing?.tcgplayer;
  const variant = finish === 'Reverse Holo' ? tcg?.reverseHolofoil : finish === 'Normal' ? tcg?.normal : tcg?.holofoil;
  if (tcg?.unit === 'USD' && Number.isFinite(variant?.marketPrice) && variant!.marketPrice! > 0) return { amount: variant!.marketPrice!, currency: 'USD', source: 'TCGplayer market via TCGdex', updated: tcg.updated };
  const cm = card.pricing?.cardmarket;
  // Cardmarket's general trend is not a reliable reverse-holo quote.
  const amount = finish === 'Reverse Holo' ? cm?.['trend-reverse'] : cm?.trend;
  if (cm?.unit === 'EUR' && Number.isFinite(amount) && amount! > 0) return { amount: amount!, currency: 'EUR', source: 'Cardmarket trend via TCGdex', updated: cm.updated };
  return null;
}
async function catalogFetch(path: string) {
  const response = await fetch(`https://api.tcgdex.net/v2/${path}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Catalogue unavailable');
  return response.json();
}
const languages: Record<string,string> = { English: 'en', Japanese: 'ja', Korean: 'ko' };
export async function enrichCard(scan: ScanIdentity, selectedId?: string) {
  const lang = languages[scan.language];
  if (!lang || !scan.number || !scan.name) return { matched: false, notice: 'Check the card name and number to look up its set.' };
  let candidates: CatalogCard[];
  if (selectedId) {
    const card = await catalogFetch(`${lang}/cards/${encodeURIComponent(selectedId)}`) as CatalogCard;
    candidates = matchesCard(card, { ...scan, total: undefined }) ? [card] : [];
  } else {
    const query = new URLSearchParams({ name: scan.language === 'English' ? scan.name : scan.original_name || scan.name, localId: scan.number, 'pagination:page': '1', 'pagination:itemsPerPage': '30' });
    const list = await catalogFetch(`${lang}/cards?${query}`) as {id:string;name:string;localId:string}[];
    const exact = list.filter(c => normaliseNumber(c.localId) === normaliseNumber(scan.number) && normaliseName(c.name) === normaliseName(scan.language === 'English' ? scan.name : scan.original_name || scan.name));
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
  const result = { matched: true, catalog_id: card.id, set: card.set.name, rarity, holo_type: holo, pricing: null as null | { gbp: string; source: string; updated: string; original: number; currency: string; rate: number; rate_date: string }, notice: finish ? 'Catalogue match found. Check the artwork and condition before publishing.' : 'Set and rarity found. Confirm the finish before requesting a price.' };
  const quote = marketQuote(card, finish);
  if (!quote) { result.notice += ' No reliable price is available for this variant.'; return result; }
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
