// src/components/AdminUploadForm.tsx
"use client";

import { useState, FormEvent, useRef } from "react";
import AdminManageCards from "./AdminManageCards";
import AdminOrderLog from "./AdminOrderLog";
import AdminBulkUpload from "./AdminBulkUpload";

/* ────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────── */
interface TCGPlayerPrice {
  low: number | null; mid: number | null; high: number | null;
  market: number | null; directLow?: number | null;
}
interface TCGPlayerPrices {
  normal?: TCGPlayerPrice; holofoil?: TCGPlayerPrice; reverseHolofoil?: TCGPlayerPrice;
  '1stEditionHolofoil'?: TCGPlayerPrice; '1stEditionNormal'?: TCGPlayerPrice;
}
interface TCGPlayer { url: string; updatedAt: string; prices: TCGPlayerPrices; }
interface PokemonTCGCardImage { small: string; large: string; }
interface PokemonTCGCard {
  id: string; name: string; number?: string; images: PokemonTCGCardImage;
  tcgplayer?: TCGPlayer; rarity?: string;
  set?: { id: string; name: string; series?: string; printedTotal?: number; };
}
interface PokemonTCGApiResponse { data: PokemonTCGCard[]; }
interface ScrapedCard {
  name: string; number: string; set: string; rarity: string | null;
  image_url: string; price: number; available: boolean;
  scan_url: string | null; language: string | null; holo_type: string | null;
}
interface SelectedImageDetail {
  url: string;
  file: File | null;
  publicId?: string;
  source: "upload" | "api" | "generated";
  apiCardName?: string;
  holoType?: string | null;
}

/* ────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────── */
export default function AdminUploadForm() {
  const [tab, setTab] = useState<'upload' | 'manage' | 'bulk' | 'orders'>('upload');

  /* core state */
  const [name, setName]           = useState("");
  const [cardNumber, setNumber]   = useState("");
  const [setCode, setSetCode]     = useState("");
  const [rarity, setRarity]       = useState("");
  const [price, setPrice]         = useState("");
  const [files, setFiles]         = useState<FileList | null>(null);
  const [selectedImages, setSel]  = useState<SelectedImageDetail[]>([]);
  const [holoType, setHoloType]   = useState<string | null>(null);
  const [language, setLanguage]   = useState<string>("English");

  /* scan queue + wizard */
  interface ScanQueueItem {
    id: string;
    file: File;
    previewUrl: string;
    status: 'scanning' | 'done' | 'error';
    originalName?: string;
    englishName?: string;
    cardNumber?: string;
    cardTotal?: string;
    language?: string;
    holoType?: string | null;   // null = not detected, must be picked before match grid shows
    error?: string;
    apiResults?: PokemonTCGCard[];
    searchQuery?: string;
  }

  const SPECIAL_HOLOS = [
    'Pokeball Holo','Master Ball Holo','Cosmos Holo',
    'Full Art','Alt Art','Illustration Rare','Special Illustration Rare',
    'Hyper Rare','Mega Hyper Rare','Mega Attack Rare',
    'Double Rare','Ultra Rare','Shiny Rare','Shiny Ultra Rare',
    'Radiant Rare','Amazing','ACE SPEC rare','Rare BREAK','Promo',
  ];

  const HOLO_OPTIONS = [
    { label: 'Normal',                    color: '#2a2a42' },
    { label: 'Common',                    color: '#2a2a42' },
    { label: 'Uncommon',                  color: '#1a3a2a' },
    { label: 'Rare',                      color: '#1a2a4a' },
    { label: 'Rare Holo',                color: '#5e4a10' },
    { label: 'Rare Holo EX',             color: '#5e4a10' },
    { label: 'Rare Holo GX',             color: '#5e4a10' },
    { label: 'Rare Holo Lv.X',           color: '#5e4a10' },
    { label: 'Rare Prime',               color: '#4a3a10' },
    { label: 'LEGEND',                   color: '#5e4510' },
    { label: 'Ultra Rare',               color: '#3a1a6e' },
    { label: 'Double Rare',              color: '#4a3a10' },
    { label: 'ACE SPEC rare',            color: '#5e2a00' },
    { label: 'Rare BREAK',              color: '#4a2a00' },
    { label: 'Promo',                    color: '#5e1040' },
    { label: 'Amazing',                  color: '#1a4a3a' },
    { label: 'Radiant Rare',             color: '#3a4a1a' },
    { label: 'Illustration Rare',        color: '#1a3a5e' },
    { label: 'Special Illustration Rare',color: '#5e3010' },
    { label: 'Shiny Rare',               color: '#2a1a5e' },
    { label: 'Shiny Ultra Rare',         color: '#3a1a6e' },
    { label: 'Hyper Rare',               color: '#5e1a3a' },
    { label: 'Black White rare',         color: '#3a3a3a' },
    { label: 'Mega Hyper Rare',          color: '#6e1a1a' },
    { label: 'Mega Attack Rare',         color: '#6e2a00' },
    { label: 'Reverse Holo',             color: '#1a3a5e' },
    { label: 'Pokeball Holo',            color: '#5e1a1a' },
    { label: 'Master Ball Holo',         color: '#2a1a6e' },
    { label: 'Cosmos Holo',              color: '#0a2a5e' },
    { label: 'Full Art',                 color: '#1a5e3a' },
    { label: 'Alt Art',                  color: '#2e5e1a' },
    { label: 'Holo Rare',                color: '#5e4a10' },
  ];

  const [scanQueue, setScanQueue] = useState<ScanQueueItem[]>([]);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardActive, setWizardActive] = useState(false);

  /* helpers */
  const [msg, setMsg]             = useState("");
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping]   = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setTerm]     = useState("");
  const [results, setResults]     = useState<PokemonTCGCard[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleApiResponse = async (response: Response) => {
    const responseText = await response.text();
    if (!response.ok) {
      // Don't leak raw HTML error pages to the user
      const isHtml = responseText.trim().startsWith('<');
      const msg = isHtml
        ? `Server error (${response.status}) — please try again`
        : responseText || `Request failed (${response.status})`;
      throw new Error(msg);
    }
    try { return JSON.parse(responseText); }
    catch { throw new Error("Received an invalid response from the server."); }
  };

  async function searchPokemonCard(name: string, number?: string, total?: string): Promise<{ results: PokemonTCGCard[]; query: string }> {
    const tcg = async (q: string) => {
      const r = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=8&orderBy=-set.releaseDate`);
      const j = await r.json();
      return (j.data ?? []) as PokemonTCGCard[];
    };
    if (name && number && total) { const q = `name:"${name}" number:${number} set.printedTotal:${total}`; const r = await tcg(q); if (r.length) return { results: r, query: q }; }
    if (name && total) { const q = `name:"${name}" set.printedTotal:${total}`; const r = await tcg(q); if (r.length) return { results: r, query: q }; }
    if (name && number) { const q = `name:"${name}" number:${number}`; const r = await tcg(q); if (r.length) return { results: r, query: q }; }
    if (name) { const q = `name:"${name}"`; const r = await tcg(q); if (r.length) return { results: r, query: q }; }
    if (name) { const q = `name:${name}*`; const r = await tcg(q); return { results: r, query: q }; }
    return { results: [], query: '' };
  }

  async function handleScanPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    setResults([]);
    setMsg('');

    const newItems: ScanQueueItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'scanning' as const,
    }));

    setScanQueue(prev => {
      const updated = [...prev, ...newItems];
      return updated;
    });
    setWizardActive(true);
    setWizardIndex(0);

    for (const item of newItems) {
      try {
        const fd = new FormData();
        fd.append("image", item.file);
        const r = await fetch("/api/scan-card", { method: "POST", body: fd });
        const d = await r.json();
        if (d.error) throw new Error(d.error);

        const englishName = d.english_name ?? '';
        const originalName = d.original_name ?? englishName;
        const cardNum: string | undefined = d.card_number ?? undefined;
        const cardTotal: string | undefined = d.card_total ?? undefined;
        const detectedLanguage: string | undefined = d.language ?? undefined;
        // null means AI didn't detect it — user must pick before match grid shows
        const detectedHoloType: string | null = d.holo_type ?? null;

        const searchResults = await searchPokemonCard(englishName, cardNum, cardTotal);

        setScanQueue(prev => prev.map(i => i.id === item.id ? {
          ...i, status: 'done', originalName, englishName,
          cardNumber: cardNum, cardTotal, language: detectedLanguage,
          holoType: detectedHoloType,
          apiResults: searchResults.results, searchQuery: searchResults.query,
        } : i));
      } catch (err: any) {
        const errMsg = typeof err.message === 'string' && err.message.trim().startsWith('<')
          ? 'Scan timed out — please try again'
          : (err.message || 'Unknown error');
        setScanQueue(prev => prev.map(i => i.id === item.id ? {
          ...i, status: 'error', error: errMsg,
        } : i));
        // Keep the photo so the user can still upload manually
        setSel([{ url: item.previewUrl, file: item.file, source: 'upload', apiCardName: 'Scanned photo', holoType: null }]);
        setMsg('Scan failed — photo kept. Fill in card name, number & price and click Add Card.');
      }
    }
  }

  const pickImage = async (card: PokemonTCGCard, version: string, marketPrice: number | null) => {
    setMsg(`Loading ${card.name}…`);
    try {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(card.images.large)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Failed to fetch card image");
      const blob = await res.blob();
      const file = new File([blob], "card.png", { type: blob.type || "image/png" });
      const objectURL = URL.createObjectURL(file);

      setSel([{ url: objectURL, file, source: "api", apiCardName: card.name, holoType: version }]);
      if (marketPrice !== null) setPrice(String(Math.round(marketPrice * 100)));
      setRarity(card.rarity ?? "");
      setHoloType(version);
      if (currentItem?.language) setLanguage(currentItem.language);

      if (card.set) {
        setSetCode(card.set.series ? `${card.set.name} | ${card.set.series}` : card.set.name);
      }
      if (card.number) {
        const total = card.set?.printedTotal;
        setNumber(total ? `${card.number}/${total}` : card.number);
      }
      if (card.name) {
        const num = card.number ?? '';
        const total = card.set?.printedTotal ? `/${card.set.printedTotal}` : '';
        const setDisplayName = card.set?.name ?? '';
        const series = card.set?.series ? ` | ${card.set.series}` : '';
        setName(`${card.name}${num ? ` ${num}${total}` : ''} ${setDisplayName}${series}`.trim());
      }
      setMsg('');

      // ── Background PriceCharting fetch ──────────────────────────────────────
      // For JP/KR cards: get a clean card image + accurate price from PC
      // For Reverse Holo: get the actual reverse holo scan from PC (TCG API gives same image as Normal)
      // For special holos: get accurate sold price (TCGPlayer doesn't track these)
      const isNonEnglish = currentItem?.language && currentItem.language !== 'English';
      const isReverseHolo = version === 'Reverse Holo' || version === 'Reverse Holofoil' || version === 'reverseHolofoil';
      const needsPC = isNonEnglish || isReverseHolo || SPECIAL_HOLOS.includes(version);
      if (needsPC) {
        setMsg('🔍 Fetching PriceCharting data…');
        void (async () => {
          try {
            const params = new URLSearchParams({
              name: card.name,
              // JP/KR: use the AI-scanned number (e.g. 123), not the English TCG API number (e.g. 6)
              number: (isNonEnglish && currentItem?.cardNumber) ? currentItem.cardNumber : (card.number ?? ''),
              holo_type: version,
              language: currentItem?.language ?? 'English',
              set_name: card.set?.name ?? '',
              set_series: card.set?.series ?? '',
            });
            const pcRes = await fetch(`/api/pricecharting?${params}`);
            const pcData = await pcRes.json();
            if (pcData.error) {
              setMsg(`⚠ PC error: ${pcData.error}`);
            } else if (pcData.not_found) {
              setMsg(`⚠ PC: not found (tried: ${pcData.url})`);
            } else {
              // For JP/KR and special holos: use PC price (more accurate than TCGPlayer)
              // For English Reverse Holo: keep TCGPlayer price (it tracks reverseHolofoil accurately)
              if (pcData.price && !isReverseHolo) setPrice(String(pcData.price));
              // Update image for JP/KR and Reverse Holo — PC has actual holographic card scans
              if ((isNonEnglish || isReverseHolo) && pcData.image_url) {
                const imgRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(pcData.image_url)}`);
                if (imgRes.ok) {
                  const imgBlob = await imgRes.blob();
                  const imgFile = new File([imgBlob], 'card.jpg', { type: imgBlob.type || 'image/jpeg' });
                  setSel([{ url: URL.createObjectURL(imgFile), file: imgFile, source: 'api', apiCardName: card.name, holoType: version }]);
                }
              }
              setMsg(`✓ PC: ${pcData.url}`);
            }
          } catch (err: any) {
            setMsg(`⚠ PC fetch failed: ${err.message}`);
          }
        })();
      }
    } catch (error: any) {
      setMsg(`Error loading image: ${error.message}`);
    }
  };

  async function handleSearch(e: FormEvent) {
    e.preventDefault(); if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(searchTerm)}"&pageSize=10&orderBy=-set.releaseDate`);
      const j: PokemonTCGApiResponse = await handleApiResponse(r);
      setResults(j.data);
    } catch (e: any) { setMsg(`Search error: ${e.message}`); }
    finally { setSearching(false); }
  }

  async function handleScrape() {
    if (!name.trim() || !cardNumber.trim()) { setMsg("Card name and number required."); return; }
    setScraping(true);
    try {
      const r = await fetch(`/api/card/scrape?name=${encodeURIComponent(name)}&number=${encodeURIComponent(cardNumber)}`);
      const d: ScrapedCard = await handleApiResponse(r);
      setSetCode(d.set); setRarity(d.rarity ?? ""); setPrice(String(d.price));
      if (d.image_url) setSel([{ url: d.image_url, source: "api", apiCardName: d.name, holoType: d.holo_type, file: null }]);
      setTerm(d.name); setHoloType(d.holo_type);
      setMsg("Fields populated.");
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    finally { setScraping(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (!name || !cardNumber || (!files && !selectedImages.length)) { setMsg("Name, number & image required."); return; }
    const p = Number(price); if (isNaN(p) || p < 0) { setMsg("Price must be a non-negative number."); return; }

    setUploading(true);
    try {
      const imageToUpload = selectedImages.length > 0 ? selectedImages[0].file : (files ? files[0] : null);
      if (!imageToUpload) throw new Error("No image file available to upload.");

      const fd = new FormData();
      fd.append("file", imageToUpload);
      const u = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, public_id } = await handleApiResponse(u);

      const body = { name, number: cardNumber, price: p, set: setCode, rarity, image_url: url, scan_url: public_id, available: true, language, holo_type: holoType };
      const res = await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await handleApiResponse(res);

      // Reset form fields
      setName(""); setNumber(""); setSetCode(""); setRarity(""); setPrice("");
      setFiles(null); setSel([]); setTerm(""); setResults([]); setHoloType(null); setLanguage("English");
      const fi = document.getElementById("file-input") as HTMLInputElement | null;
      if (fi) fi.value = "";

      // Advance wizard
      if (wizardActive && wizardIndex < scanQueue.length - 1) {
        const next = scanQueue[wizardIndex + 1];
        setWizardIndex(i => i + 1);
        setMsg(`✔ Card added! Now on card ${wizardIndex + 2} of ${scanQueue.length}.`);
        if (next?.status === 'done') {
          if (next.englishName) setName(next.englishName);
          if (next.cardNumber) setNumber(next.cardNumber);
          if (next.language) setLanguage(next.language);
        }
      } else {
        setMsg("✔ All done!");
        setWizardActive(false);
        setScanQueue([]);
        setWizardIndex(0);
      }
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    finally { setUploading(false); }
  }

  function skipWizardCard() {
    if (wizardIndex < scanQueue.length - 1) {
      const next = scanQueue[wizardIndex + 1];
      setWizardIndex(i => i + 1);
      setName(""); setNumber(""); setSetCode(""); setRarity(""); setPrice(""); setSel([]); setResults([]);
      if (next?.status === 'done') {
        if (next.englishName) setName(next.englishName);
        if (next.cardNumber) setNumber(next.cardNumber);
        if (next.language) setLanguage(next.language);
      }
    } else {
      setWizardActive(false);
      setScanQueue([]);
      setWizardIndex(0);
      setName(""); setNumber(""); setSetCode(""); setRarity(""); setPrice(""); setSel([]); setResults([]);
    }
  }

  // Current wizard item
  const currentItem = wizardActive ? scanQueue[wizardIndex] : null;

  // Render version pick buttons for a card
  const renderVersionButtons = (card: PokemonTCGCard) => {
    const prices = card.tcgplayer?.prices;
    if (!prices) return (
      <button type="button" style={s.pickBtn} onClick={() => pickImage(card, 'Normal', null)}>Use Image (no price data)</button>
    );
    const versions = Object.entries(prices).map(([key, val]) => ({ name: key, price: val?.market })).filter(v => v.price != null);
    if (!versions.length) return (
      <button type="button" style={s.pickBtn} onClick={() => pickImage(card, 'Normal', null)}>Use Image (no price data)</button>
    );
    return versions.map(v => {
      const label = v.name.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
      return (
        <button key={v.name} type="button" style={s.pickBtn} onClick={() => pickImage(card, label, v.price ?? null)}>
          {label} — £{((v.price ?? 0) * 0.79).toFixed(2)}
        </button>
      );
    });
  };

  /* ── Inline styles ─────────────────────────────────────── */
  const s: Record<string, React.CSSProperties> = {
    wrap: { maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' },
    card: { background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' },
    h1: { textAlign: 'center', margin: '0 0 1.5rem', fontSize: 22, color: '#c4b5fd' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#7c6af0', marginBottom: 4 },
    input: { width: '100%', padding: '0.6rem 0.8rem', background: '#0f0f1e', border: '1px solid #3d3d6e', borderRadius: 6, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' },
    row: { display: 'flex', gap: 10 },
    group: { marginBottom: '1rem' },
    btn: { padding: '0.6rem 1.2rem', border: 'none', borderRadius: 6, background: 'linear-gradient(135deg,#7c6af0,#5b4dd4)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    btnGhost: { padding: '0.5rem 1rem', border: '1px solid #3d3d6e', borderRadius: 6, background: 'transparent', color: '#c4b5fd', cursor: 'pointer', fontSize: 13 },
    submitBtn: { width: '100%', padding: '1rem', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#7c6af0,#5b4dd4)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,106,240,0.4)', marginTop: 8 },
    flash: { padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem', background: '#1a3a2a', border: '1px solid #2d6a4f', color: '#86efac', fontSize: 13 },
    flashErr: { padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem', background: '#3a1a1a', border: '1px solid #6a2d2d', color: '#fca5a5', fontSize: 13 },
    // Wizard
    wizardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
    progress: { display: 'flex', gap: 6, alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: '50%', background: '#2d2d4e' },
    dotActive: { width: 10, height: 10, borderRadius: '50%', background: '#7c6af0' },
    dotDone: { width: 10, height: 10, borderRadius: '50%', background: '#86efac' },
    scanCard: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: '1rem' },
    scanThumb: { width: 90, height: 126, objectFit: 'cover', borderRadius: 6, border: '2px solid #3d3d6e', flexShrink: 0 },
    scanInfo: { flex: 1 },
    badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginRight: 4 },
    badgeGreen: { background: '#1a3a2a', color: '#86efac', border: '1px solid #2d6a4f' },
    badgeRed: { background: '#3a1a1a', color: '#fca5a5', border: '1px solid #6a2d2d' },
    badgeBlue: { background: '#1a2a3a', color: '#93c5fd', border: '1px solid #2d4a6a' },
    // Match grid
    matchGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginTop: 10 },
    matchItem: { background: '#0f0f1e', border: '1px solid #3d3d6e', borderRadius: 8, padding: 8, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s' },
    matchImg: { width: '100%', borderRadius: 4, marginBottom: 6 },
    matchName: { fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 },
    matchSet: { fontSize: 10, color: '#7c7c9e' },
    // Selected image
    selBox: { display: 'flex', gap: 12, alignItems: 'center', padding: '0.75rem', background: '#0f0f1e', borderRadius: 8, border: '1px solid #3d3d6e' },
    selImg: { width: 60, height: 84, objectFit: 'cover', borderRadius: 4, border: '1px solid #3d3d6e' },
    hr: { border: 'none', borderTop: '1px solid #2d2d4e', margin: '1.2rem 0' },
    // Inline rescan
    rescanRow: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' as const },
  };

  const tabBar: React.CSSProperties = { display: 'flex', gap: 6, padding: '1rem 1rem 0', borderBottom: '1px solid #1e1e3a', marginBottom: 0 };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700,
    padding: '8px 20px', border: '1px solid', borderBottom: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
    background: active ? '#0f0f22' : 'transparent',
    color: active ? '#c4b5fd' : '#4a4a72',
    borderColor: active ? '#3d3d6e' : 'transparent',
    position: 'relative', bottom: -1,
  });

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Tab bar ── */}
      <div style={tabBar}>
        <button style={tabBtn(tab === 'upload')} onClick={() => setTab('upload')}>➕ Upload</button>
        <button style={tabBtn(tab === 'manage')} onClick={() => setTab('manage')}>🗂 Manage Cards</button>
        <button style={tabBtn(tab === 'bulk')}   onClick={() => setTab('bulk')}>📋 Bulk CSV</button>
        <button style={tabBtn(tab === 'orders')} onClick={() => setTab('orders')}>📦 Orders</button>
      </div>

      {/* ── Manage tab ── */}
      {tab === 'manage' && (
        <div style={{ ...s.wrap, padding: '1.5rem' }}>
          <AdminManageCards />
        </div>
      )}

      {/* ── Bulk CSV tab ── */}
      {tab === 'bulk' && (
        <div style={{ ...s.wrap, padding: '1.5rem' }}>
          <AdminBulkUpload />
        </div>
      )}

      {/* ── Orders tab ── */}
      {tab === 'orders' && (
        <div style={{ ...s.wrap, padding: '1.5rem' }}>
          <AdminOrderLog />
        </div>
      )}

      {/* ── Upload tab ── */}
      {tab !== 'manage' && (
      <div style={s.wrap}>

        {/* ── WIZARD MODE ─────────────────────────────────── */}
        {wizardActive && currentItem && (
          <div style={s.card}>
            {/* Header: progress */}
            <div style={s.wizardHeader}>
              <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 15 }}>
                Card {wizardIndex + 1} of {scanQueue.length}
              </span>
              <div style={s.progress}>
                {scanQueue.map((item, i) => (
                  <div key={item.id} style={
                    i === wizardIndex ? s.dotActive :
                    i < wizardIndex ? s.dotDone : s.dot
                  } />
                ))}
              </div>
              <button type="button" style={s.btnGhost} onClick={skipWizardCard}>
                {wizardIndex < scanQueue.length - 1 ? 'Skip →' : 'Done'}
              </button>
            </div>

            {/* Scanned photo + AI result */}
            <div style={s.scanCard}>
              <img src={currentItem.previewUrl} alt="scan" style={s.scanThumb} />
              <div style={s.scanInfo}>
                {currentItem.status === 'scanning' && (
                  <p style={{ color: '#7c7c9e', margin: 0 }}>⏳ Scanning with AI…</p>
                )}
                {currentItem.status === 'error' && (
                  <>
                    <span style={{ ...s.badge, ...s.badgeRed }}>✗ Scan failed</span>
                    <p style={{ color: '#fca5a5', fontSize: 12, margin: '6px 0 0' }}>{currentItem.error}</p>
                  </>
                )}
                {currentItem.status === 'done' && (
                  <>
                    <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15 }}>
                      {currentItem.englishName || '(unknown)'}
                    </p>
                    {currentItem.originalName && currentItem.originalName !== currentItem.englishName && (
                      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#7c7c9e' }}>{currentItem.originalName}</p>
                    )}
                    <div>
                      {currentItem.apiResults?.length
                        ? <span style={{ ...s.badge, ...s.badgeGreen }}>✓ {currentItem.apiResults.length} matches</span>
                        : <span style={{ ...s.badge, ...s.badgeRed }}>✗ No matches</span>
                      }
                      {currentItem.language === 'Japanese'
                        ? <span style={{ ...s.badge, ...s.badgeBlue }}>🇯🇵 JP</span>
                        : currentItem.language === 'Korean'
                        ? <span style={{ ...s.badge, ...s.badgeBlue }}>🇰🇷 KR</span>
                        : <span style={{ ...s.badge, ...s.badgeBlue }}>🇬🇧 EN</span>
                      }
                    </div>
                    {currentItem.cardNumber && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7c7c9e' }}>
                        #{currentItem.cardNumber}{currentItem.cardTotal ? `/${currentItem.cardTotal}` : ''}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Holo type blocker ── shown when scan is done but type unknown */}
            {currentItem.status === 'done' && !currentItem.holoType && (
              <div style={{ background: '#0a0a1a', borderRadius: 10, padding: '1rem', border: '2px solid #7c6af0', marginTop: 4 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, color: '#c4b5fd', fontSize: 13 }}>
                  🃏 AI couldn't detect the holo type — what type is this card?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {HOLO_OPTIONS.map(({ label, color }) => (
                    <button key={label} type="button"
                      style={{ background: color, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e2e8f0', padding: '7px 4px', fontSize: 10, cursor: 'pointer', fontWeight: 600, lineHeight: 1.3 }}
                      onClick={() => {
                        setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, holoType: label } : i));
                        setHoloType(label);
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── AI detected holo type — show with change button ── */}
            {currentItem.status === 'done' && currentItem.holoType && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 12, color: '#86efac' }}>
                  ✓ <strong>{currentItem.holoType}</strong>
                </span>
                <button type="button"
                  style={{ ...s.btnGhost, fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, holoType: null } : i))}>
                  Change
                </button>
              </div>
            )}

            {/* ── Search correction row + match grid (only when holo type is set) ── */}
            {currentItem.status === 'done' && currentItem.holoType && (
              <>
                <div style={s.rescanRow}>
                  <input
                    placeholder="Name"
                    defaultValue={currentItem.englishName ?? ''}
                    onChange={e => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, englishName: e.target.value } : i))}
                    style={{ ...s.input, flex: '2 1 120px' }}
                  />
                  <input
                    placeholder="#"
                    defaultValue={currentItem.cardNumber ?? ''}
                    onChange={e => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, cardNumber: e.target.value } : i))}
                    style={{ ...s.input, flex: '1 1 60px' }}
                  />
                  <input
                    placeholder="Total"
                    defaultValue={currentItem.cardTotal ?? ''}
                    onChange={e => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, cardTotal: e.target.value } : i))}
                    style={{ ...s.input, flex: '1 1 70px' }}
                  />
                  <button type="button" style={s.btn} onClick={async () => {
                    setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, status: 'scanning' } : i));
                    const r = await searchPokemonCard(currentItem.englishName ?? '', currentItem.cardNumber, currentItem.cardTotal);
                    setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, status: 'done', apiResults: r.results } : i));
                  }}>🔍</button>
                </div>

                {/* Match grid — one Select button per card, price reflects chosen holo type */}
                {currentItem.apiResults && currentItem.apiResults.length > 0 && (
                  <>
                    <p style={{ margin: '10px 0 4px', fontSize: 12, color: '#7c7c9e' }}>Pick the matching card:</p>
                    <div style={s.matchGrid}>
                      {currentItem.apiResults.map(card => {
                        const prices = card.tcgplayer?.prices;
                        const ht = currentItem.holoType!;
                        // Choose the most relevant TCGPlayer price tier for this holo type
                        let refPrice: number | null = null;
                        if (['Reverse Holo','Pokeball Holo','Master Ball Holo','Cosmos Holo'].includes(ht))
                          refPrice = prices?.reverseHolofoil?.market ?? prices?.holofoil?.market ?? null;
                        else if (ht === 'Holo Rare')
                          refPrice = prices?.holofoil?.market ?? null;
                        else if (ht === 'Normal')
                          refPrice = prices?.normal?.market ?? null;
                        else
                          // Special holos — show holofoil as a reference; PC will give the real price in background
                          refPrice = prices?.holofoil?.market ?? prices?.normal?.market ?? null;

                        const priceLabel = refPrice
                          ? `£${(refPrice * 0.79).toFixed(2)}${SPECIAL_HOLOS.includes(ht) ? ' ref' : ''}`
                          : null;

                        return (
                          <div key={card.id} style={s.matchItem}>
                            <img src={card.images.small} alt={card.name} style={s.matchImg} />
                            <div style={s.matchName}>{card.name}</div>
                            <div style={s.matchSet}>{card.set?.name}</div>
                            <div style={{ marginTop: 6 }}>
                              <button type="button"
                                style={{ ...s.btn, fontSize: 10, padding: '5px 6px', width: '100%' }}
                                onClick={() => pickImage(card, ht, refPrice)}>
                                Select{priceLabel ? ` — ${priceLabel}` : ''}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MAIN FORM ───────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={s.card}>
          <h1 style={s.h1}>{wizardActive ? '📋 Card Details' : '➕ Add New Card'}</h1>

          {msg && <div style={msg.startsWith('Error') || msg.startsWith('✗') ? s.flashErr : s.flash}>{msg}</div>}

          {/* Scan input — only show when not in wizard mode */}
          {!wizardActive && (
            <div style={s.group}>
              <label style={s.label}>📷 Scan Physical Card Photos</label>
              <input type="file" accept="image/*" multiple onChange={handleScanPhotos}
                style={{ ...s.input, padding: '0.5rem' }} />
            </div>
          )}

          {/* Add more cards button when in wizard */}
          {wizardActive && (
            <div style={{ ...s.group, textAlign: 'center' as const }}>
              <label style={{ ...s.label, textAlign: 'center' as const }}>📷 Add more cards to queue</label>
              <input type="file" accept="image/*" multiple onChange={handleScanPhotos}
                style={{ ...s.input, padding: '0.5rem' }} />
            </div>
          )}

          <hr style={s.hr} />

          {/* Selected image preview */}
          {selectedImages.length > 0 && (
            <div style={{ ...s.group }}>
              <label style={s.label}>Selected Image</label>
              <div style={s.selBox}>
                <img src={selectedImages[0].url} alt="selected" style={s.selImg} />
                <span style={{ fontSize: 13, color: '#c4b5fd' }}>{selectedImages[0].apiCardName} {selectedImages[0].holoType ? `(${selectedImages[0].holoType})` : ''}</span>
              </div>
            </div>
          )}

          <div style={s.group}>
            <label style={s.label}>Card Name</label>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div style={{ ...s.row }}>
            <div style={{ ...s.group, flex: 1 }}>
              <label style={s.label}>Card Number</label>
              <input style={s.input} value={cardNumber} onChange={e => setNumber(e.target.value)} required />
            </div>
            <div style={{ ...s.group, flex: 1 }}>
              <label style={s.label}>Price (pence)</label>
              <input type="number" min="0" style={s.input} value={price} onChange={e => setPrice(e.target.value)} required />
              {(holoType === 'Pokeball Holo' || holoType === 'Master Ball Holo' || holoType === 'Cosmos Holo') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {[1,2,3,4,5,6,7,8].map(p => (
                    <button key={p} type="button"
                      style={{ background: '#1a2a40', border: '1px solid #2a4a70', borderRadius: 4, color: '#93c5fd', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                      onClick={() => setPrice(String(p * 100))}
                    >£{p}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ ...s.row }}>
            <div style={{ ...s.group, flex: 1 }}>
              <label style={s.label}>Set</label>
              <input style={s.input} value={setCode} onChange={e => setSetCode(e.target.value)} />
            </div>
            <div style={{ ...s.group, flex: 1 }}>
              <label style={s.label}>Rarity</label>
              <input style={s.input} value={rarity} onChange={e => setRarity(e.target.value)} />
            </div>
          </div>

          <div style={{ ...s.row }}>
            <div style={{ ...s.group, flex: 1 }}>
              <label style={s.label}>Language</label>
              <select style={s.input} value={language} onChange={e => setLanguage(e.target.value)}>
                <option>English</option><option>Japanese</option><option>Korean</option>
                <option>Chinese</option><option>French</option><option>German</option><option>Spanish</option>
              </select>
            </div>
            <div style={{ ...s.group, flex: 1 }}>
              <label style={s.label}>Holo Type</label>
              <input style={s.input} value={holoType ?? ''} onChange={e => setHoloType(e.target.value)} />
            </div>
          </div>

          <hr style={s.hr} />

          {/* Manual search (collapsed when not needed) */}
          {!wizardActive && (
            <div style={s.group}>
              <label style={s.label}>🔍 Search Pokémon TCG API</label>
              <div style={s.row}>
                <input style={{ ...s.input, flex: 1 }} placeholder="Pokémon name" value={searchTerm} onChange={e => setTerm(e.target.value)} />
                <button type="button" style={s.btn} onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                  {searching ? '…' : 'Search'}
                </button>
              </div>
              {results.length > 0 && (
                <div style={{ marginTop: 10, border: '1px solid #2d2d4e', borderRadius: 8, overflow: 'hidden' }}>
                  {results.map(card => (
                    <div key={card.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: '1px solid #2d2d4e', alignItems: 'flex-start', background: '#0f0f1e' }}>
                      <img src={card.images.small} alt={card.name} width={50} style={{ borderRadius: 4, border: '1px solid #3d3d6e' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{card.name}</div>
                        <div style={{ fontSize: 11, color: '#7c7c9e', marginBottom: 4 }}>{card.set?.name} · #{card.number}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{renderVersionButtons(card)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload own image */}
          <div style={s.group}>
            <label style={s.label}>📁 Upload Your Own Image</label>
            <input id="file-input" type="file" accept="image/*" style={{ ...s.input, padding: '0.5rem' }}
              onChange={e => { setFiles(e.target.files); if (e.target.files?.length) setMsg(`Image ready — fill in details and click Add Card.`); }} />
            {files && files.length > 0 && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#86efac' }}>✔ {files[0].name}</p>}
          </div>

          <button style={s.submitBtn} type="submit" disabled={uploading}>
            {uploading ? 'Uploading…' : wizardActive && wizardIndex < scanQueue.length - 1 ? `Add Card & Next → (${wizardIndex + 1}/${scanQueue.length})` : 'Add Card ✔'}
          </button>
        </form>
      </div>
      )}
    </>
  );
}
