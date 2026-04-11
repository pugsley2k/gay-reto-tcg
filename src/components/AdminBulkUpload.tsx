"use client";
import React, { useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ── CSV parser (handles quoted fields with commas inside) ── */
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/* ── Language detection from product name ── */
function detectLanguage(productName: string): string {
  if (/\(JP\)/i.test(productName)) return 'Japanese';
  if (/\(KR\)/i.test(productName)) return 'Korean';
  if (/\(CN\)/i.test(productName)) return 'Chinese';
  if (/\(TW\)/i.test(productName)) return 'Chinese';
  return 'English';
}

/* ── Rarity + Variance → holo_type mapping ── */
function mapRarityAndVariance(rarity: string, variance: string): string {
  const r = rarity.toLowerCase().trim();
  const v = variance.toLowerCase().trim();

  // Special rarities take precedence over variance
  if (r === 'art rare')                   return 'Illustration Rare';
  if (r === 'special art rare')           return 'Special Illustration Rare';
  if (r === 'illustration rare')          return 'Illustration Rare';
  if (r === 'special illustration rare')  return 'Special Illustration Rare';
  if (r === 'ultra rare')                 return 'Ultra Rare';
  if (r === 'double rare')                return 'Double Rare';
  if (r === 'hyper rare')                 return 'Hyper Rare';
  if (r === 'secret rare')                return 'Hyper Rare';   // JP "Secret Rare" = gold/rainbow = Hyper Rare
  if (r === 'shiny rare')                 return 'Shiny Rare';
  if (r === 'shiny ultra rare')           return 'Shiny Ultra Rare';
  if (r === 'radiant rare')               return 'Radiant Rare';
  if (r === 'ace spec rare' || r === 'ace spec') return 'ACE SPEC rare';
  if (r === 'rare break')                 return 'Rare BREAK';
  if (r === 'promo')                      return 'Promo';
  if (r === 'trainer gallery')            return 'Illustration Rare';
  if (r === 'amazing rare')               return 'Amazing';

  // Holo Rare — reverse holofoil variant = Reverse Holo, standard = Holo Rare
  if (r === 'holo rare' || r === 'rare holo') {
    return v === 'reverse holofoil' ? 'Reverse Holo' : 'Holo Rare';
  }

  // Plain Rare
  if (r === 'rare') {
    if (v === 'reverse holofoil') return 'Reverse Holo';
    if (v === 'holofoil' || v === 'foil') return 'Holo Rare';
    return 'Rare';
  }

  // Common / Uncommon / anything else
  if (v === 'reverse holofoil') return 'Reverse Holo';
  if (v === 'holofoil' || v === 'foil') return 'Holo Rare';
  return 'Normal';
}

/* ── Types ── */
interface PortfolioRow {
  portfolioName: string;
  category: string;
  set: string;
  productName: string;
  cardNumber: string;
  rarity: string;
  variance: string;
  grade: string;
  condition: string;
  avgCostPaid: number;
  quantity: number;
  marketPrice: number;
  priceOverride: number;
  watchlist: string;
  dateAdded: string;
  notes: string;
}

interface MappedCard {
  name: string;
  number: string;
  set: string;
  rarity: string;
  holo_type: string;
  price: number;      // in pence
  available: boolean;
  image_url: string | null;
  language: string;
  _error?: string;
  _imageStatus?: 'pending' | 'found' | 'not_found' | 'skipped';
}

function parsePortfolioCSV(raw: string, gbpRate: number): MappedCard[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect header row
  const firstRow = parseCSVRow(lines[0]);
  const hasHeader = firstRow.some(c => /product name|card number|category|portfolio/i.test(c));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line): MappedCard => {
    const cols = parseCSVRow(line);
    // Expected columns (0-based):
    // 0:Portfolio Name, 1:Category, 2:Set, 3:Product Name, 4:Card Number,
    // 5:Rarity, 6:Variance, 7:Grade, 8:Card Condition, 9:Average Cost Paid,
    // 10:Quantity, 11:Market Price, 12:Price Override, 13:Watchlist, 14:Date Added, 15:Notes

    const category    = cols[1]  ?? '';
    const set         = cols[2]  ?? '';
    const productName = cols[3]  ?? '';
    const cardNumber  = cols[4]  ?? '';
    const rarity      = cols[5]  ?? '';
    const variance    = cols[6]  ?? '';
    const quantityRaw = cols[10] ?? '0';
    const marketRaw   = cols[11] ?? '0';
    const overrideRaw = cols[12] ?? '0';

    const quantity     = parseInt(quantityRaw, 10) || 0;
    const marketUSD    = parseFloat(marketRaw.replace(/[$,]/g, ''))  || 0;
    const overrideUSD  = parseFloat(overrideRaw.replace(/[$,]/g, '')) || 0;
    const priceUSD     = overrideUSD > 0 ? overrideUSD : marketUSD;
    const priceGBPp    = Math.round(priceUSD * gbpRate * 100); // convert USD → GBP pence

    const error = !productName ? 'Missing product name'
                : category.toLowerCase() !== 'pokemon' ? `Skipped: category is "${category}"`
                : undefined;

    return {
      name:      productName,
      number:    cardNumber,
      set,
      rarity,
      holo_type: mapRarityAndVariance(rarity, variance),
      price:     priceGBPp,
      available: quantity > 0,
      image_url: null,
      language:  detectLanguage(productName),
      _error:    error,
      _imageStatus: 'pending',
    };
  });
}

/* ── Image lookup via Pokémon TCG API ── */
function cleanCardName(name: string): string {
  return name
    .replace(/\s*\(JP\)\s*/gi, '')
    .replace(/\s*\(Basic\)\s*/gi, '')
    .replace(/\s*\(Unlimited\)\s*/gi, '')
    .replace(/\s*\(1st Edition\)\s*/gi, '')
    .replace(/\s*·.*$/, '')   // strip "· Holo Rare" suffixes
    .replace(/\s+/g, ' ')
    .trim();
}

async function tcgFetch(q: string): Promise<any[]> {
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10&select=id,name,number,images,set`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

async function fetchImage(card: MappedCard): Promise<string | null> {
  try {
    // name may already be cleaned when called from fetchImageForCard
    const name   = card.name.includes('(') ? cleanCardName(card.name) : card.name;
    const number = card.number?.split('/')[0]?.replace(/^0+/, '') ?? ''; // "021" → "21"

    // 1st attempt: name + number
    let cards = number ? await tcgFetch(`name:"${name}" number:${number}`) : [];

    // 2nd attempt: name only
    if (!cards.length) cards = await tcgFetch(`name:"${name}"`);

    if (!cards.length) return null;

    // Prefer card whose set name loosely matches
    const setLower = card.set.toLowerCase();
    const match = cards.find(c =>
      c.set?.name?.toLowerCase().includes(setLower) ||
      setLower.includes(c.set?.name?.toLowerCase() ?? '')
    ) ?? cards[0];

    return match?.images?.large ?? match?.images?.small ?? null;
  } catch {
    return null;
  }
}

/* ── Styles ── */
const inputStyle: React.CSSProperties = {
  background: '#0f0f22', border: '1px solid #2d2d50', borderRadius: 6,
  color: '#d0d0f0', padding: '10px', fontSize: 12, width: '100%',
  fontFamily: 'Space Mono, monospace',
};
const btnStyle = (color = 'linear-gradient(90deg,#7c6af0,#b84fff)'): React.CSSProperties => ({
  background: color, border: 'none', borderRadius: 5,
  color: '#fff', padding: '8px 18px', fontSize: 12,
  cursor: 'pointer', fontFamily: 'Space Mono, monospace', whiteSpace: 'nowrap',
});
const thStyle: React.CSSProperties = {
  textAlign: 'left', fontSize: 10, color: '#5a5a8a', padding: '6px 8px',
  borderBottom: '1px solid #1e1e3a', letterSpacing: '0.1em', textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = {
  padding: '5px 8px', borderBottom: '1px solid #111128', fontSize: 11, verticalAlign: 'top',
};

/* ── Holo types that need PriceCharting scans instead of TCG API ── */
const PC_HOLO_TYPES = new Set([
  'Reverse Holo', 'Reverse Holofoil', 'reverseHolofoil',
  'Holo Rare', 'Holofoil', 'holofoil', 'Rare Holo',
  'Pokeball Holo', 'Master Ball Holo', 'Cosmos Holo',
  'Ultra Rare', 'Full Art', 'Alt Art',
  'Illustration Rare', 'Special Illustration Rare',
  'Hyper Rare', 'Mega Hyper Rare', 'Mega Attack Rare',
  'Shiny Rare', 'Shiny Ultra Rare', 'Radiant Rare',
  'Double Rare', 'ACE SPEC rare', 'Rare BREAK', 'Promo',
]);

async function fetchImageForCard(card: {
  name: string; number: string | null; set: string | null; holo_type: string | null;
}): Promise<string | null> {
  const holoType = card.holo_type ?? 'Normal';
  const name     = cleanCardName(card.name);
  const number   = card.number ?? '';
  const set      = card.set    ?? '';

  if (PC_HOLO_TYPES.has(holoType)) {
    // Use PriceCharting for actual holo scans
    try {
      const params = new URLSearchParams({
        name, number, holo_type: holoType, set_name: set, language: 'English', set_series: '',
      });
      const res  = await fetch(`/api/pricecharting?${params}`);
      const data = await res.json();
      if (data.image_url) return data.image_url;
    } catch { /* fall through to TCG API */ }
  }

  // TCG API for Normal / Common / Uncommon / Rare (no special scan needed)
  return fetchImage({ name, number, set, rarity: '', holo_type: holoType, price: 0, available: true, image_url: null, language: 'English' });
}

/* ── Backfill images for existing cards with null image_url ── */
async function backfillImages(
  onProgress: (done: number, total: number) => void,
  abortRef: React.MutableRefObject<boolean>,
  limit?: number,
): Promise<{ updated: number; failed: number; cards: { name: string; url: string | null }[] }> {
  let allCards: { id: string; name: string; number: string | null; set: string | null; holo_type: string | null }[] = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from('Card')
      .select('id, name, number, set, holo_type')
      .is('image_url', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (!data || data.length === 0) break;
    allCards = allCards.concat(data);
    if (data.length < PAGE) break;
    page++;
  }

  if (limit) allCards = allCards.slice(0, limit);

  let updated = 0;
  let failed  = 0;
  const cards: { name: string; url: string | null }[] = [];

  // Process in batches of 3 (PC scraping is slower — be gentle)
  const BATCH = 3;
  for (let i = 0; i < allCards.length; i += BATCH) {
    if (abortRef.current) break;
    const batch = allCards.slice(i, i + BATCH);
    await Promise.all(batch.map(async card => {
      const url = await fetchImageForCard(card);
      cards.push({ name: card.name, url });
      if (url) {
        const { error } = await supabase.from('Card').update({ image_url: url }).eq('id', card.id);
        if (!error) updated++; else failed++;
      } else {
        failed++;
      }
    }));
    onProgress(Math.min(i + BATCH, allCards.length), allCards.length);
    await new Promise(r => setTimeout(r, 500));
  }

  return { updated, failed, cards };
}

/* ── Delete all cards from DB (for clean re-import) ── */
function DeleteAllCardsButton() {
  const [confirm, setConfirm]   = useState(false);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<{ msg: string; ok: boolean } | null>(null);

  async function handleDelete() {
    setRunning(true);
    setResult(null);
    // Supabase requires a filter — delete all rows by matching id > 0
    const { error, count } = await supabase
      .from('Card')
      .delete({ count: 'exact' })
      .gte('id', 0);
    setRunning(false);
    setConfirm(false);
    if (error) {
      setResult({ ok: false, msg: `Error: ${error.message}` });
    } else {
      setResult({ ok: true, msg: `Deleted ${count ?? 'all'} cards. You can now re-import your CSV.` });
    }
  }

  return (
    <div>
      {!confirm && !running && (
        <button style={btnStyle('linear-gradient(90deg,#7f1d1d,#dc2626)')} onClick={() => setConfirm(true)}>
          🗑 Delete All Cards
        </button>
      )}
      {confirm && !running && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#f87171' }}>Are you sure? This cannot be undone.</span>
          <button style={btnStyle('linear-gradient(90deg,#7f1d1d,#dc2626)')} onClick={handleDelete}>Yes, delete all</button>
          <button style={btnStyle()} onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      {running && <span style={{ fontSize: 11, color: '#8080b0' }}>Deleting…</span>}
      {result && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginTop: 12, fontSize: 12,
          background: result.ok ? 'rgba(6,214,160,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${result.ok ? 'rgba(6,214,160,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color: result.ok ? '#06d6a0' : '#f87171',
        }}>
          {result.msg}
        </div>
      )}
    </div>
  );
}

/* ── Fix language for existing JP/KR cards ── */
function FixLanguageButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<{ msg: string; ok: boolean } | null>(null);

  async function handleFix() {
    setRunning(true);
    setResult(null);
    let updated = 0;

    // JP cards
    const { data: jpCards } = await supabase
      .from('Card')
      .select('id, name')
      .ilike('name', '%(JP)%')
      .neq('language', 'Japanese');

    if (jpCards?.length) {
      const ids = jpCards.map(c => c.id);
      await supabase.from('Card').update({ language: 'Japanese' }).in('id', ids);
      updated += ids.length;
    }

    // KR cards
    const { data: krCards } = await supabase
      .from('Card')
      .select('id, name')
      .ilike('name', '%(KR)%')
      .neq('language', 'Korean');

    if (krCards?.length) {
      const ids = krCards.map(c => c.id);
      await supabase.from('Card').update({ language: 'Korean' }).in('id', ids);
      updated += ids.length;
    }

    setRunning(false);
    setResult({ ok: true, msg: `Updated language on ${updated} card${updated !== 1 ? 's' : ''}.` });
  }

  return (
    <div>
      {!running && (
        <button style={btnStyle('linear-gradient(90deg,#ffd166,#ff8c42)')} onClick={handleFix}>
          Fix JP/KR Language
        </button>
      )}
      {running && <span style={{ fontSize: 11, color: '#8080b0' }}>Fixing…</span>}
      {result && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginTop: 12, fontSize: 12,
          background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.3)', color: '#06d6a0',
        }}>
          {result.msg}
        </div>
      )}
    </div>
  );
}

/* ── Component ── */
export default function AdminBulkUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawCSV, setRawCSV]         = useState('');
  const [gbpRate, setGbpRate]       = useState(0.79);   // USD → GBP default
  const [rows, setRows]             = useState<MappedCard[]>([]);
  const [parsed, setParsed]         = useState(false);
  const [fetchImages, setFetchImages] = useState(false);
  const [progress, setProgress]     = useState<{ done: number; total: number } | null>(null);
  const [result, setResult]         = useState<{ msg: string; ok: boolean } | null>(null);
  const abortRef = useRef(false);

  // Backfill state
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);
  const [backfillResult, setBackfillResult]     = useState<{ msg: string; ok: boolean; testCards?: { name: string; url: string | null }[] } | null>(null);
  const backfillAbort = useRef(false);

  async function handleBackfill(limit?: number) {
    backfillAbort.current = false;
    setBackfillResult(null);
    setBackfillProgress({ done: 0, total: 0 });
    const { updated, failed, cards } = await backfillImages(
      (done, total) => setBackfillProgress({ done, total }),
      backfillAbort,
      limit,
    );
    setBackfillProgress(null);
    setBackfillResult({
      ok: updated > 0 || (limit !== undefined && cards.length > 0),
      msg: `Updated ${updated} card image${updated !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} not found` : ''}.`,
      testCards: limit !== undefined ? cards : undefined,
    });
  }

  const validRows   = rows.filter(r => !r._error);
  const skippedRows = rows.filter(r =>  r._error);
  const pokemonOnly = skippedRows.filter(r => r._error && !r._error.startsWith('Skipped'));

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setRawCSV(ev.target?.result as string ?? '');
      setRows([]);
      setParsed(false);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function handleParse() {
    setResult(null);
    const parsed = parsePortfolioCSV(rawCSV, gbpRate);
    setRows(parsed);
    setParsed(true);
  }

  async function handleImport() {
    if (!validRows.length) return;
    abortRef.current = false;
    setProgress({ done: 0, total: validRows.length });
    setResult(null);

    let toInsert = [...validRows];

    /* Optional image lookup — in batches of 5 with small delay */
    if (fetchImages) {
      const updatedRows = [...validRows];
      for (let i = 0; i < updatedRows.length; i += 5) {
        if (abortRef.current) break;
        const batch = updatedRows.slice(i, i + 5);
        await Promise.all(batch.map(async (card, bi) => {
          const url = await fetchImage(card);
          updatedRows[i + bi] = { ...card, image_url: url, _imageStatus: url ? 'found' : 'not_found' };
        }));
        setProgress({ done: Math.min(i + 5, updatedRows.length), total: updatedRows.length });
        await new Promise(r => setTimeout(r, 300)); // rate-limit padding
      }
      toInsert = updatedRows;
    }

    /* Insert to Supabase in batches of 100 */
    const BATCH = 100;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < toInsert.length; i += BATCH) {
      if (abortRef.current) break;
      const batch = toInsert.slice(i, i + BATCH).map(r => ({
        name:      r.name,
        number:    r.number    || null,
        set:       r.set       || null,
        rarity:    r.rarity    || null,
        holo_type: r.holo_type || 'Normal',
        price:     r.price,
        available: r.available,
        image_url: r.image_url || null,
        language:  r.language  || 'English',
      }));

      const { data, error } = await supabase.from('Card').insert(batch).select('id');
      if (error) {
        errors.push(error.message);
      } else {
        inserted += data?.length ?? batch.length;
      }
      if (!fetchImages) {
        setProgress({ done: Math.min(i + BATCH, toInsert.length), total: toInsert.length });
      }
    }

    setProgress(null);
    if (errors.length) {
      setResult({ ok: false, msg: `Inserted ${inserted} cards. ${errors.length} batch error(s): ${errors[0]}` });
    } else {
      setResult({ ok: true, msg: `✓ Successfully imported ${inserted} cards!` });
      setRows([]);
      setRawCSV('');
      setParsed(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleCancel() {
    abortRef.current = true;
  }

  return (
    <div style={{ fontFamily: 'Space Mono, monospace', color: '#d0d0f0', paddingBottom: '2rem' }}>

      {/* Info block */}
      <div style={{ background: '#0c0c1e', border: '1px solid #2d2d50', borderRadius: 8, padding: '12px 16px', marginBottom: '1.5rem', fontSize: 11 }}>
        <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 6 }}>Portfolio CSV Import</div>
        <div style={{ color: '#8080b0', lineHeight: 1.7 }}>
          Accepts the export format from your portfolio tracker. Expected columns:<br />
          <code style={{ color: '#ffd166' }}>Portfolio Name, Category, Set, Product Name, Card Number, Rarity, Variance, Grade, Card Condition, Average Cost Paid, Quantity, Market Price, Price Override, Watchlist, Date Added, Notes</code><br />
          <span style={{ color: '#5a5a8a' }}>Only "Pokemon" category rows are imported. Price Override used when &gt; 0, otherwise Market Price. USD → GBP conversion applied.</span>
        </div>
      </div>

      {/* File + rate row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#5a5a8a', marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            style={{ ...inputStyle, cursor: 'pointer' }}
          />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#5a5a8a', marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>USD → GBP Rate</label>
          <input
            type="number"
            step="0.01"
            min="0.1"
            max="2"
            value={gbpRate}
            onChange={e => setGbpRate(parseFloat(e.target.value) || 0.79)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <button
          style={btnStyle()}
          onClick={handleParse}
          disabled={!rawCSV.trim()}
        >
          Preview
        </button>
      </div>

      {/* Parsed summary */}
      {parsed && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1rem', fontSize: 11 }}>
          <span style={{ color: '#06d6a0' }}>✓ {validRows.length} cards to import</span>
          {pokemonOnly.length > 0 && <span style={{ color: '#f87171' }}>✗ {pokemonOnly.length} with errors</span>}
          <span style={{ color: '#5a5a8a' }}>⊘ {skippedRows.length - pokemonOnly.length} non-Pokémon skipped</span>
          <span style={{ color: '#ffd166' }}>
            Total value: £{(validRows.reduce((s, r) => s + r.price, 0) / 100).toFixed(2)}
          </span>
        </div>
      )}

      {/* Import controls */}
      {validRows.length > 0 && !progress && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#8080b0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={fetchImages}
              onChange={e => setFetchImages(e.target.checked)}
              style={{ accentColor: '#b84fff' }}
            />
            Fetch images from Pokémon TCG API (slower, ~{Math.ceil(validRows.length / 5) * 0.3}s)
          </label>
          <button
            style={btnStyle('linear-gradient(90deg,#06d6a0,#118ab2)')}
            onClick={handleImport}
          >
            Import {validRows.length} cards
          </button>
        </div>
      )}

      {/* Progress bar */}
      {progress && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6, color: '#8080b0' }}>
            <span>{fetchImages ? 'Fetching images & importing…' : 'Importing…'} {progress.done}/{progress.total}</span>
            <button onClick={handleCancel} style={{ background: 'none', border: '1px solid #5a5a8a', borderRadius: 4, color: '#a0a0c0', fontSize: 10, cursor: 'pointer', padding: '2px 8px' }}>Cancel</button>
          </div>
          <div style={{ background: '#1a1a30', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(progress.done / progress.total) * 100}%`,
              background: 'linear-gradient(90deg,#7c6af0,#b84fff)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Result message */}
      {result && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: '1rem', fontSize: 12,
          background: result.ok ? 'rgba(6,214,160,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${result.ok ? 'rgba(6,214,160,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color: result.ok ? '#06d6a0' : '#f87171',
        }}>
          {result.msg}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <div style={{ fontSize: 10, color: '#5a5a8a', marginBottom: 8 }}>
            Showing {rows.length} rows (✓ will import, ✗ skipped)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Number</th>
                <th style={thStyle}>Set</th>
                <th style={thStyle}>Rarity</th>
                <th style={thStyle}>Holo Type</th>
                <th style={thStyle}>Price (GBP)</th>
                <th style={thStyle}>Available</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, i) => (
                <tr key={i} style={{ opacity: row._error ? 0.4 : 1 }}>
                  <td style={tdStyle}>
                    {row._error
                      ? <span title={row._error} style={{ color: '#f87171', fontSize: 12 }}>✗</span>
                      : <span style={{ color: '#06d6a0', fontSize: 12 }}>✓</span>
                    }
                  </td>
                  <td style={{ ...tdStyle, color: '#c0c0e0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.name || <em style={{ color: '#5a5a8a' }}>—</em>}
                  </td>
                  <td style={tdStyle}>{row.number || '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.set || '—'}</td>
                  <td style={tdStyle}>{row.rarity || '—'}</td>
                  <td style={{ ...tdStyle, color: '#a78bfa' }}>{row.holo_type}</td>
                  <td style={{ ...tdStyle, color: row._error ? '#5a5a8a' : '#ffd166' }}>
                    {row._error ? '—' : `£${(row.price / 100).toFixed(2)}`}
                  </td>
                  <td style={{ ...tdStyle, color: row.available ? '#06d6a0' : '#5a5a8a' }}>
                    {row.available ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <div style={{ fontSize: 10, color: '#5a5a8a', marginTop: 8, textAlign: 'center' }}>
              Showing first 200 of {rows.length} rows. All {validRows.length} valid cards will be imported.
            </div>
          )}
        </div>
      )}

      {/* ── Danger zone: delete all cards for clean re-import ── */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid #1e1e3a', paddingTop: '1.5rem' }}>
        <div style={{ color: '#f87171', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>⚠ Reset & Re-import</div>
        <div style={{ color: '#5a5a8a', fontSize: 11, marginBottom: 12 }}>
          Deletes every card from the database so you can do a clean re-import with the corrected rarity, language, and image logic.
        </div>
        <DeleteAllCardsButton />
      </div>

      {/* ── Fix language on existing JP cards ── */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid #1e1e3a', paddingTop: '1.5rem' }}>
        <div style={{ color: '#ffd166', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Fix Language on JP/KR Cards</div>
        <div style={{ color: '#5a5a8a', fontSize: 11, marginBottom: 12 }}>
          Finds all cards whose name contains "(JP)" or "(KR)" and sets their language field correctly.
        </div>
        <FixLanguageButton />
      </div>

      {/* ── Backfill missing images ── */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid #1e1e3a', paddingTop: '1.5rem' }}>
        <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Fix Missing Images</div>
        <div style={{ color: '#5a5a8a', fontSize: 11, marginBottom: 12 }}>
          Finds all cards in the database with no image and looks them up on the Pokémon TCG API.
        </div>

        {!backfillProgress && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={btnStyle('linear-gradient(90deg,#06d6a0,#118ab2)')} onClick={() => handleBackfill(1)}>
              Test 1 Card
            </button>
            <button style={btnStyle('linear-gradient(90deg,#ff8c42,#ff3e6c)')} onClick={() => handleBackfill()}>
              Backfill All Missing Images
            </button>
          </div>
        )}

        {backfillProgress && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6, color: '#8080b0' }}>
              <span>
                {backfillProgress.total === 0
                  ? 'Counting cards…'
                  : `Looking up images… ${backfillProgress.done}/${backfillProgress.total}`}
              </span>
              <button onClick={() => { backfillAbort.current = true; }} style={{ background: 'none', border: '1px solid #5a5a8a', borderRadius: 4, color: '#a0a0c0', fontSize: 10, cursor: 'pointer', padding: '2px 8px' }}>Cancel</button>
            </div>
            {backfillProgress.total > 0 && (
              <div style={{ background: '#1a1a30', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(backfillProgress.done / backfillProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg,#ff8c42,#ff3e6c)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {backfillResult && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 6, fontSize: 12,
              background: backfillResult.ok ? 'rgba(6,214,160,0.1)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${backfillResult.ok ? 'rgba(6,214,160,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color: backfillResult.ok ? '#06d6a0' : '#f87171',
            }}>
              {backfillResult.msg}
            </div>
            {backfillResult.testCards && backfillResult.testCards.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12, background: '#0c0c1e', border: '1px solid #2d2d50', borderRadius: 8, padding: 12 }}>
                {c.url
                  ? <img src={c.url} alt={c.name} style={{ width: 80, borderRadius: 4, flexShrink: 0 }} />
                  : <div style={{ width: 80, height: 110, background: '#1a1a30', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#5a5a8a', flexShrink: 0 }}>No image</div>
                }
                <div>
                  <div style={{ fontSize: 11, color: '#c0c0e0', marginBottom: 4 }}>{c.name}</div>
                  {c.url
                    ? <div style={{ fontSize: 10, color: '#06d6a0' }}>✓ Image found</div>
                    : <div style={{ fontSize: 10, color: '#f87171' }}>✗ Not found — check name/set/holo_type</div>
                  }
                  {c.url && <div style={{ fontSize: 9, color: '#5a5a8a', wordBreak: 'break-all', marginTop: 4 }}>{c.url}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
