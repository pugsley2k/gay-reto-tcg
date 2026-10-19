// src/components/AdminUploadForm.tsx
"use client";
import studio from './SellerStudio.module.css';
import legacy from './AdminUploadForm.module.css';
import CollectionInsights from './CollectionInsights';
import { isCardArtwork } from '@/lib/card-artwork';
import { CARD_CONDITIONS } from '@/lib/card-condition';

import { useState, useEffect, FormEvent, useRef } from "react";
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
  const [tab, setTab] = useState<'upload' | 'manage' | 'bulk' | 'orders' | 'insights'>('upload');
  useEffect(() => { const selected=new URLSearchParams(window.location.search).get('tab');if(selected==='manage'||selected==='orders')setTab(selected); }, []);

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
  const [condition, setCondition] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importSource, setImportSource] = useState('');
  const [importing, setImporting] = useState(false);
  const [importReviewed, setImportReviewed] = useState(false);
  const [listingId, setListingId] = useState('');
  const [importPriceNote, setImportPriceNote] = useState('');

  async function importLink() {
    setImporting(true); setMsg('');
    try {
      const response = await fetch('/api/admin/import-card', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:importUrl})});
      const card = await response.json();
      if(!response.ok)throw new Error(card.error || 'Could not import this card.');
      setName(card.name); setNumber(card.number); setSetCode(card.set); setRarity(''); setPrice(card.price===null?'':String(card.price)); setImportPriceNote(card.price_note); setLanguage(''); setCondition(''); setHoloType(null);
      setFiles(null); setSel([{url:card.image_url,file:null,source:'api',apiCardName:card.name}]);
      setImportSource(card.source_url); setImportReviewed(false); setListingId(crypto.randomUUID());
      setWizardActive(false); setResults([]); setTerm('');
      const input=document.getElementById('file-input') as HTMLInputElement|null; if(input)input.value='';
      setMsg('Card and catalogue image imported. Review the PriceCharting price, choose language, condition and finish, then check the artwork before adding it.');
    } catch(error) {setMsg(`Error: ${error instanceof Error?error.message:'Could not import this card.'}`);}
    finally {setImporting(false);}
  }

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
    { label: 'Normal',                    color: '#34383f' },
    { label: 'Common',                    color: '#34383f' },
    { label: 'Uncommon',                  color: '#34383f' },
    { label: 'Rare',                      color: '#34383f' },
    { label: 'Rare Holo',                color: '#34383f' },
    { label: 'Rare Holo EX',             color: '#34383f' },
    { label: 'Rare Holo GX',             color: '#34383f' },
    { label: 'Rare Holo Lv.X',           color: '#34383f' },
    { label: 'Rare Prime',               color: '#34383f' },
    { label: 'LEGEND',                   color: '#34383f' },
    { label: 'Ultra Rare',               color: '#34383f' },
    { label: 'Double Rare',              color: '#34383f' },
    { label: 'ACE SPEC rare',            color: '#34383f' },
    { label: 'Rare BREAK',              color: '#191b20' },
    { label: 'Promo',                    color: '#34383f' },
    { label: 'Amazing',                  color: '#34383f' },
    { label: 'Radiant Rare',             color: '#34383f' },
    { label: 'Illustration Rare',        color: '#34383f' },
    { label: 'Special Illustration Rare',color: '#34383f' },
    { label: 'Shiny Rare',               color: '#34383f' },
    { label: 'Shiny Ultra Rare',         color: '#34383f' },
    { label: 'Hyper Rare',               color: '#34383f' },
    { label: 'Black White rare',         color: '#34383f' },
    { label: 'Mega Hyper Rare',          color: '#34383f' },
    { label: 'Mega Attack Rare',         color: '#34383f' },
    { label: 'Reverse Holo',             color: '#34383f' },
    { label: 'Pokeball Holo',            color: '#34383f' },
    { label: 'Master Ball Holo',         color: '#34383f' },
    { label: 'Cosmos Holo',              color: '#34383f' },
    { label: 'Full Art',                 color: '#34383f' },
    { label: 'Alt Art',                  color: '#34383f' },
    { label: 'Holo Rare',                color: '#34383f' },
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
    if(importSource) {
      const missing = [[!language,'language','manual-language'],[!holoType?.trim(),'finish (for example, Normal, Holo or Reverse Holo)','manual-finish'],[!condition,'card condition','manual-condition'],[!price.trim(),'selling price','manual-price'],[!importReviewed,'the review confirmation','import-review']] as const;
      const errors=missing.filter(([invalid])=>invalid);
      if(errors.length){setMsg(`Error: Complete ${errors.map(([,label])=>label).join(', ')} before adding this card.`);document.getElementById(errors[0][2])?.focus();return;}
    }
    if (!name || !cardNumber || (!files && !selectedImages.length)) { setMsg("Name, number & image required."); return; }
    const p = Number(price); if (isNaN(p) || p < 0) { setMsg("Price must be a non-negative number."); return; }

    setUploading(true);
    try {
      const imageToUpload = selectedImages[0]?.file || files?.[0] || null;
      let url = selectedImages[0]?.url; let public_id: string|null = null; let frontPhoto: string|null=null;
      if(imageToUpload) {
        const fd = new FormData(); fd.append('file',imageToUpload);
        const u=await fetch('/api/upload',{method:'POST',body:fd});
        const uploaded=await handleApiResponse(u); if(importSource){frontPhoto=uploaded.url;}else{url=uploaded.url;}public_id=uploaded.public_id;
      } else if(!isCardArtwork(url)) throw new Error('Choose catalogue artwork or upload a listing image.');

      const body = { name, number: cardNumber, price: p, set: setCode, rarity, image_url: url, front_image_url:frontPhoto, scan_url: public_id, available: true, language, holo_type: holoType, condition:condition||null, ...(listingId?{client_id:listingId}:{}) };
      const res = await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await handleApiResponse(res);

      // Reset form fields
      setName(""); setNumber(""); setSetCode(""); setRarity(""); setPrice("");
      setFiles(null); setSel([]); setTerm(""); setResults([]); setHoloType(null); setLanguage("English");
      setImportSource(''); setImportUrl(''); setImportReviewed(false); setCondition(''); setListingId('');
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
      <button type="button" className={studio.primary} onClick={() => pickImage(card, 'Normal', null)}>Use image (no price available)</button>
    );
    const versions = Object.entries(prices).map(([key, val]) => ({ name: key, price: val?.market })).filter(v => v.price != null);
    if (!versions.length) return (
      <button type="button" className={studio.primary} onClick={() => pickImage(card, 'Normal', null)}>Use image (no price available)</button>
    );
    return versions.map(v => {
      const label = v.name.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
      return (
        <button key={v.name} type="button" className={studio.primary} onClick={() => pickImage(card, label, v.price ?? null)}>
          {label} — £{((v.price ?? 0) * 0.79).toFixed(2)}
        </button>
      );
    });
  };

  /* ── Inline styles ─────────────────────────────────────── */
  const s: Record<string, React.CSSProperties> = {
    wrap: { maxWidth: 640, margin: '2rem auto', fontFamily: 'Manrope, sans-serif', color: '#f0eee7' },
    card: { background: '#191b20', border: '1px solid #34383f', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' },
    h1: { textAlign: 'center', margin: '0 0 1.5rem', fontSize: 22, color: '#faeac4' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#faeac4', marginBottom: 4 },
    input: { width: '100%', padding: '0.6rem 0.8rem', background: '#191b20', border: '1px solid #34383f', borderRadius: 6, color: '#f0eee7', fontSize: 14, boxSizing: 'border-box' },
    row: { display: 'flex', gap: 10 },
    group: { marginBottom: '1rem' },
    btn: { padding: '0.6rem 1.2rem', border: 'none', borderRadius: 6, background: '#faeac4', color: '#191b20', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    btnGhost: { padding: '0.5rem 1rem', border: '1px solid #34383f', borderRadius: 6, background: 'transparent', color: '#faeac4', cursor: 'pointer', fontSize: 13 },
    submitBtn: { width: '100%', padding: '1rem', border: 'none', borderRadius: 8, background: '#faeac4', color: '#191b20', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(250,234,196,0.12)', marginTop: 8 },
    flash: { padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem', background: '#34383f', border: '1px solid #34383f', color: '#86efac', fontSize: 13 },
    flashErr: { padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem', background: '#191b20', border: '1px solid #34383f', color: '#fca5a5', fontSize: 13 },
    // Wizard
    wizardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
    progress: { display: 'flex', gap: 6, alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: '50%', background: '#34383f' },
    dotActive: { width: 10, height: 10, borderRadius: '50%', background: '#faeac4' },
    dotDone: { width: 10, height: 10, borderRadius: '50%', background: '#86efac' },
    scanCard: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: '1rem' },
    scanThumb: { width: 90, height: 126, objectFit: 'cover', borderRadius: 6, border: '2px solid #34383f', flexShrink: 0 },
    scanInfo: { flex: 1 },
    badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginRight: 4 },
    badgeGreen: { background: '#34383f', color: '#86efac', border: '1px solid #34383f' },
    badgeRed: { background: '#191b20', color: '#fca5a5', border: '1px solid #34383f' },
    badgeBlue: { background: '#34383f', color: '#faeac4', border: '1px solid #34383f' },
    // Match grid
    matchGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginTop: 10 },
    matchItem: { background: '#191b20', border: '1px solid #34383f', borderRadius: 8, padding: 8, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s' },
    matchImg: { width: '100%', borderRadius: 4, marginBottom: 6 },
    matchName: { fontSize: 11, fontWeight: 700, color: '#f0eee7', marginBottom: 2 },
    matchSet: { fontSize: 10, color: '#b8b7b0' },
    // Selected image
    selBox: { display: 'flex', gap: 12, alignItems: 'center', padding: '0.75rem', background: '#191b20', borderRadius: 8, border: '1px solid #34383f' },
    selImg: { width: 60, height: 84, objectFit: 'cover', borderRadius: 4, border: '1px solid #34383f' },
    hr: { border: 'none', borderTop: '1px solid #34383f', margin: '1.2rem 0' },
    // Inline rescan
    rescanRow: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' as const },
  };

  return (
    <>
      <canvas ref={canvasRef} className={legacy.style0} />

      {/* ── Tab bar ── */}
      <nav className={studio.navigation} aria-label="Seller studio sections">
        {([['upload','Manual listing'],['manage','Inventory'],['bulk','CSV import'],['orders','Orders & dispatch'],['insights','Collection & sales']] as const).map(([value,label])=><button key={value} className={studio.tab} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}
      </nav>

      {/* ── Manage tab ── */}
      {tab === 'manage' && (
        <div className={studio.panel}>
          <AdminManageCards />
        </div>
      )}

      {/* ── Bulk CSV tab ── */}
      {tab === 'bulk' && (
        <div className={studio.panel}>
          <AdminBulkUpload />
        </div>
      )}

      {/* ── Orders tab ── */}
      {tab === 'orders' && (
        <div className={studio.panel}>
          <AdminOrderLog />
        </div>
      )}

      {tab === 'insights' && <div className={studio.panel}><CollectionInsights/></div>}
      {/* ── Upload tab ── */}
      {tab === 'upload' && (
      <div className={studio.manual}>

        {/* ── WIZARD MODE ─────────────────────────────────── */}
        {wizardActive && currentItem && (
          <div className={legacy.style7}>
            {/* Header: progress */}
            <div className={legacy.style8}>
              <span className={legacy.style9}>
                Card {wizardIndex + 1} of {scanQueue.length}
              </span>
              <div className={legacy.style10}>
                {scanQueue.map((item, i) => (
                  <div key={item.id} style={
                    i === wizardIndex ? s.dotActive :
                    i < wizardIndex ? s.dotDone : s.dot
                  } />
                ))}
              </div>
              <button type="button" className={legacy.style11} onClick={skipWizardCard}>
                {wizardIndex < scanQueue.length - 1 ? 'Skip →' : 'Done'}
              </button>
            </div>

            {/* Scanned photo + AI result */}
            <div className={legacy.style12}>
              <img src={currentItem.previewUrl} alt="scan" className={legacy.style13} />
              <div className={legacy.style14}>
                {currentItem.status === 'scanning' && (
                  <p className={legacy.style15}>⏳ Scanning with AI…</p>
                )}
                {currentItem.status === 'error' && (
                  <>
                    <span className={legacy.style16}>✗ Scan failed</span>
                    <p className={legacy.style17}>{currentItem.error}</p>
                  </>
                )}
                {currentItem.status === 'done' && (
                  <>
                    <p className={legacy.style18}>
                      {currentItem.englishName || '(unknown)'}
                    </p>
                    {currentItem.originalName && currentItem.originalName !== currentItem.englishName && (
                      <p className={legacy.style19}>{currentItem.originalName}</p>
                    )}
                    <div>
                      {currentItem.apiResults?.length
                        ? <span className={legacy.style20}>✓ {currentItem.apiResults.length} matches</span>
                        : <span className={legacy.style21}>✗ No matches</span>
                      }
                      {currentItem.language === 'Japanese'
                        ? <span className={legacy.style22}>🇯🇵 JP</span>
                        : currentItem.language === 'Korean'
                        ? <span className={legacy.style23}>🇰🇷 KR</span>
                        : <span className={legacy.style24}>🇬🇧 EN</span>
                      }
                    </div>
                    {currentItem.cardNumber && (
                      <p className={legacy.style25}>
                        #{currentItem.cardNumber}{currentItem.cardTotal ? `/${currentItem.cardTotal}` : ''}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Holo type blocker ── shown when scan is done but type unknown */}
            {currentItem.status === 'done' && !currentItem.holoType && (
              <div className={legacy.style26}>
                <p className={legacy.style27}>
                  🃏 AI couldn't detect the holo type — what type is this card?
                </p>
                <div className={legacy.style28}>
                  {HOLO_OPTIONS.map(({ label, color }) => (
                    <button key={label} type="button"
                      style={{ background: color, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#f0eee7', padding: '7px 4px', fontSize: 10, cursor: 'pointer', fontWeight: 600, lineHeight: 1.3 }}
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
              <div className={legacy.style29}>
                <span className={legacy.style30}>
                  ✓ <strong>{currentItem.holoType}</strong>
                </span>
                <button type="button"
                  className={legacy.style31}
                  onClick={() => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, holoType: null } : i))}>
                  Change
                </button>
              </div>
            )}

            {/* ── Search correction row + match grid (only when holo type is set) ── */}
            {currentItem.status === 'done' && currentItem.holoType && (
              <>
                <div className={legacy.style32}>
                  <input
                    placeholder="Name"
                    defaultValue={currentItem.englishName ?? ''}
                    onChange={e => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, englishName: e.target.value } : i))}
                    className={legacy.style33}
                  />
                  <input
                    placeholder="#"
                    defaultValue={currentItem.cardNumber ?? ''}
                    onChange={e => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, cardNumber: e.target.value } : i))}
                    className={legacy.style34}
                  />
                  <input
                    placeholder="Total"
                    defaultValue={currentItem.cardTotal ?? ''}
                    onChange={e => setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, cardTotal: e.target.value } : i))}
                    className={legacy.style35}
                  />
                  <button type="button" className={legacy.style36} onClick={async () => {
                    setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, status: 'scanning' } : i));
                    const r = await searchPokemonCard(currentItem.englishName ?? '', currentItem.cardNumber, currentItem.cardTotal);
                    setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, status: 'done', apiResults: r.results } : i));
                  }}>🔍</button>
                </div>

                {/* Match grid — one Select button per card, price reflects chosen holo type */}
                {currentItem.apiResults && currentItem.apiResults.length > 0 && (
                  <>
                    <p className={legacy.style37}>Pick the matching card:</p>
                    <div className={legacy.style38}>
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
                          <div key={card.id} className={legacy.style39}>
                            <img src={card.images.small} alt={card.name} className={legacy.style40} />
                            <div className={legacy.style41}>{card.name}</div>
                            <div className={legacy.style42}>{card.set?.name}</div>
                            <div className={legacy.style43}>
                              <button type="button"
                                className={legacy.style44}
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
        <form onSubmit={handleSubmit} className={legacy.style45} onChange={e=>{if((e.target as HTMLInputElement).id!=='import-review')setImportReviewed(false);}}>
          <h2 className={legacy.style46}>{wizardActive ? 'Card details' : 'Manual listing'}</h2>

          {msg && <div role={msg.startsWith('Error')||msg.startsWith('✗')?'alert':'status'} style={msg.startsWith('Error') || msg.startsWith('✗') ? s.flashErr : s.flash}>{msg}</div>}

          <fieldset disabled={importing||uploading} style={{border:'1px solid #ffffff36',padding:16,marginBottom:24,borderRadius:4}}>
            <legend>Import from PriceCharting link</legend>
            <p>No photo? Import the card details, catalogue artwork and PriceCharting’s ungraded guide price in GBP. Review or edit everything before listing.</p>
            <label htmlFor="import-card-url">PriceCharting item URL</label>
            <input id="import-card-url" type="url" value={importUrl} onChange={e=>setImportUrl(e.target.value)} placeholder="https://www.pricecharting.com/game/pokemon-pitch-black/slowbro-90" style={{width:'100%',margin:'8px 0'}} />
            <button type="button" className={studio.primary} onClick={importLink} disabled={!importUrl.trim()}>{importing?'Importing…':'Import card details'}</button>
            {importSource&&<p>Imported from <a href={importSource} target="_blank" rel="noopener noreferrer">PriceCharting ↗</a>. Catalogue artwork is for reference; no actual-card photos have been added.</p>}
            {importSource&&<p>{importPriceNote}</p>}
          </fieldset>

          {/* Scan input — only show when not in wizard mode */}
          {!wizardActive && (
            <div className={legacy.style47}>
              <label htmlFor="manual-scan-photos" className={legacy.style48}>Scan card photos</label>
              <input id="manual-scan-photos" type="file" accept="image/*" multiple onChange={handleScanPhotos}
                className={legacy.style49} />
            </div>
          )}

          {/* Add more cards button when in wizard */}
          {wizardActive && (
            <div className={legacy.style50}>
              <label htmlFor="manual-more-photos" className={legacy.style51}>Add more card photos</label>
              <input id="manual-more-photos" type="file" accept="image/*" multiple onChange={handleScanPhotos}
                className={legacy.style52} />
            </div>
          )}

          <hr className={legacy.style53} />

          {/* Selected image preview */}
          {selectedImages.length > 0 && (
            <div className={legacy.style54}>
              <label className={legacy.style55}>Selected Image</label>
              <div className={legacy.style56}>
                <img src={selectedImages[0].url} alt="selected" className={legacy.style57} />
                <span className={legacy.style58}>{selectedImages[0].apiCardName} {selectedImages[0].holoType ? `(${selectedImages[0].holoType})` : ''}</span>
              </div>
            </div>
          )}

          <div className={legacy.style59}>
            <label htmlFor="manual-name" className={legacy.style60}>Card Name</label>
            <input id="manual-name" className={legacy.style61} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className={legacy.style62}>
            <div className={legacy.style63}>
              <label htmlFor="manual-number" className={legacy.style64}>Card Number</label>
              <input id="manual-number" className={legacy.style65} value={cardNumber} onChange={e => setNumber(e.target.value)} required />
            </div>
            <div className={legacy.style66}>
              <label htmlFor="manual-price" className={legacy.style67}>Price (pence)</label>
              <input id="manual-price" type="number" min="0" className={legacy.style68} value={price} onChange={e => setPrice(e.target.value)} required />
              {(holoType === 'Pokeball Holo' || holoType === 'Master Ball Holo' || holoType === 'Cosmos Holo') && (
                <div className={legacy.style69}>
                  {[1,2,3,4,5,6,7,8].map(p => (
                    <button key={p} type="button"
                      className={legacy.style70}
                      onClick={() => setPrice(String(p * 100))}
                    >£{p}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={legacy.style71}>
            <div className={legacy.style72}>
              <label htmlFor="manual-set" className={legacy.style73}>Set</label>
              <input id="manual-set" className={legacy.style74} value={setCode} onChange={e => setSetCode(e.target.value)} />
            </div>
            <div className={legacy.style75}>
              <label htmlFor="manual-rarity" className={legacy.style76}>Rarity</label>
              <input id="manual-rarity" className={legacy.style77} value={rarity} onChange={e => setRarity(e.target.value)} />
            </div>
          </div>

          <div className={legacy.style78}>
            <div className={legacy.style79}>
              <label htmlFor="manual-language" className={legacy.style80}>Language</label>
              <select id="manual-language" className={legacy.style81} value={language} onChange={e => setLanguage(e.target.value)} required={!!importSource} aria-describedby={importSource&&!language?'language-help':undefined}>
                <option value="">Choose language</option>
                <option>English</option><option>Japanese</option><option>Korean</option>
                <option>Chinese</option><option>French</option><option>German</option><option>Spanish</option>
              </select>
              {importSource&&!language&&<p id="language-help">Required: choose the language printed on your card.</p>}
            </div>
            <div className={legacy.style82}>
              <label htmlFor="manual-finish" className={legacy.style83}>Finish</label>
              <input id="manual-finish" className={legacy.style84} value={holoType ?? ''} onChange={e => setHoloType(e.target.value)} required={!!importSource} placeholder="e.g. Normal, Holo, Reverse Holo" aria-describedby={importSource?'finish-help':undefined} />
              {importSource&&<p id="finish-help">Required: enter the finish of your card. PriceCharting artwork does not confirm this for you.</p>}
            </div>
          </div>

          <hr className={legacy.style85} />
          <label htmlFor="manual-condition">Card condition</label>
          <select id="manual-condition" value={condition} onChange={e=>setCondition(e.target.value)} required={!!importSource} style={{display:'block',width:'100%',marginBottom:20}}>
            <option value="">Choose condition</option>
            {CARD_CONDITIONS.map(item=><option key={item.value}>{item.value}</option>)}
          </select>
          {importSource&&<><p>Choose language, finish and condition above, then confirm below. Editing a field clears this confirmation so you can review the final details.</p><label style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:24}}><input id="import-review" type="checkbox" required checked={importReviewed} onChange={e=>setImportReviewed(e.target.checked)} />I checked the card artwork, name, set, number, language, finish, condition and my selling price against the card I own. This creates a live listing.</label></>}

          {/* Manual search (collapsed when not needed) */}
          {!wizardActive && (
            <div className={legacy.style86}>
              <label htmlFor="catalogue-search" className={legacy.style87}>Find catalogue artwork</label>
              <div className={legacy.style88}>
                <input id="catalogue-search" className={legacy.style89} placeholder="Pokémon name" value={searchTerm} onChange={e => setTerm(e.target.value)} />
                <button type="button" className={legacy.style90} onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                  {searching ? '…' : 'Search'}
                </button>
              </div>
              {results.length > 0 && (
                <div className={legacy.style91}>
                  {results.map(card => (
                    <div key={card.id} className={legacy.style92}>
                      <img src={card.images.small} alt={card.name} width={50} className={legacy.style93} />
                      <div className={legacy.style94}>
                        <div className={legacy.style95}>{card.name}</div>
                        <div className={legacy.style96}>{card.set?.name} · #{card.number}</div>
                        <div className={legacy.style97}>{renderVersionButtons(card)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload own image */}
          <div className={legacy.style98}>
            <label htmlFor="file-input" className={legacy.style99}>Upload a listing image</label>
            <input id="file-input" type="file" accept="image/*" className={legacy.style100}
              onChange={e => { setFiles(e.target.files); if (e.target.files?.length) setMsg(`Image ready — fill in details and click Add Card.`); }} />
            {files && files.length > 0 && <p className={legacy.style101}>✔ {files[0].name}</p>}
          </div>

          <button className={legacy.style102} type="submit" disabled={uploading||importing}>
            {uploading ? 'Uploading…' : wizardActive && wizardIndex < scanQueue.length - 1 ? `Add card & next → (${wizardIndex + 1}/${scanQueue.length})` : 'Add card'}
          </button>
        </form>
      </div>
      )}
    </>
  );
}
