// src/components/AdminUploadForm.tsx
"use client";

import { useState, FormEvent, useRef } from "react";

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
// **UPDATED**: Selected image can now hold a generated File object
interface SelectedImageDetail {
  url: string; // temp object URL for display
  file: File | null; // The generated file to be uploaded
  publicId?: string;
  source: "upload" | "api" | "generated";
  apiCardName?: string;
  holoType?: string | null;
}

/* ────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────── */
const isHoloLike = (holoType: string | null | undefined) => /holo/i.test(holoType ?? "");
const isReverseHolo = (holoType: string | null | undefined) => /reverse\s*holo/i.test(holoType ?? "");

const getWatermarkText = (holoType: string | null | undefined) => {
  const t = (holoType ?? "").toLowerCase();
  if (t.includes("reverse holo")) return "ReverseHolo";
  if (t.includes("holo")) return "Holo";
  if (t.includes("ex")) return "EX";
  if (t.includes("gx")) return "GX";
  if (t.includes("vmax")) return "VMAX";
  if (t.includes("vstar")) return "VSTAR";
  return "";
};

/* ────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────── */
export default function AdminUploadForm() {
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

  /* scan queue */
  interface ScanQueueItem {
    id: string;
    file: File;
    previewUrl: string;
    status: 'scanning' | 'done' | 'error';
    japaneseName?: string;
    englishName?: string;
    cardNumber?: string;
    cardTotal?: string;
    language?: string;
    error?: string;
    apiResults?: PokemonTCGCard[];
    searchQuery?: string;
  }

  async function searchPokemonCard(name: string, number?: string, total?: string): Promise<{ results: PokemonTCGCard[]; query: string }> {
    const tcg = async (q: string) => {
      const r = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=8&orderBy=-set.releaseDate`);
      const j = await r.json();
      return (j.data ?? []) as PokemonTCGCard[];
    };

    // Most specific: name + number + set total
    if (name && number && total) {
      const q = `name:"${name}" number:${number} set.printedTotal:${total}`;
      const r = await tcg(q);
      if (r.length) return { results: r, query: q };
    }

    // Name + set total (number might be wrong, but total identifies the set)
    if (name && total) {
      const q = `name:"${name}" set.printedTotal:${total}`;
      const r = await tcg(q);
      if (r.length) return { results: r, query: q };
    }

    // Name + number
    if (name && number) {
      const q = `name:"${name}" number:${number}`;
      const r = await tcg(q);
      if (r.length) return { results: r, query: q };
    }

    // Exact name only
    if (name) {
      const q = `name:"${name}"`;
      const r = await tcg(q);
      if (r.length) return { results: r, query: q };
    }

    // Wildcard fallback
    if (name) {
      const q = `name:${name}*`;
      const r = await tcg(q);
      return { results: r, query: q };
    }

    return { results: [], query: '' };
  }
  const [scanQueue, setScanQueue] = useState<ScanQueueItem[]>([]);

  /* helpers */
  const [msg, setMsg]             = useState("");
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping]   = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [searchTerm, setTerm]     = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults]     = useState<PokemonTCGCard[]>([]);

  // Hidden canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleApiResponse = async (response: Response) => {
    const responseText = await response.text();
    if (!response.ok) throw new Error(responseText || `Request failed with status ${response.status}`);
    try { return JSON.parse(responseText); }
    catch {
      console.error("Failed to parse JSON response:", responseText);
      throw new Error("Received an invalid response from the server.");
    }
  };

  /**
   * FIXED SHIMMER: now uses blending (screen) + optional reverse stripes.
   */
  const processImageWithHolo = (imageUrl: string, holoType: string | null): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return reject(new Error("Canvas not ready."));

      const img = new Image();
      img.crossOrigin = "anonymous"; // ensure non-tainted canvas
      img.src = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const holo = isHoloLike(holoType);
        const reverse = isReverseHolo(holoType);

        if (holo) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';

          // Multi‑colour shimmer
          const rainbowStops = ['#ff4d4d','#ffd24d','#4dff4d','#4dd2ff','#b84dff','#ff4dd2'];
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          rainbowStops.forEach((c, i) => {
            const stop = i / (rainbowStops.length - 1);
            gradient.addColorStop(stop, `${c}CC`); // CC ~= 0.8 alpha
          });
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Optional moving-ish sheen bands for reverse holo
          if (reverse) {
            const stripeW = canvas.width / 14;
            const angle = -15 * Math.PI / 180;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(angle);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeW * 2) {
              // pick a colour cycling through rainbowStops
              const col = rainbowStops[(Math.floor(x / stripeW)) % rainbowStops.length];
              ctx.fillStyle = `${col}33`; // light alpha
              ctx.fillRect(x, 0, stripeW, canvas.height);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
          }

          ctx.restore();
        }

        // Watermark text
        const watermarkText = getWatermarkText(holoType);
        if (watermarkText) {
          const fontSize = canvas.width / 10;
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';

          // Stroke for visibility
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = fontSize / 12;
          ctx.strokeText(watermarkText, canvas.width - 15, canvas.height - 15);

          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillText(watermarkText, canvas.width - 15, canvas.height - 15);
        }

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Failed to create blob from canvas."));
          const newFile = new File([blob], "generated-card.png", { type: 'image/png' });
          resolve(newFile);
        }, 'image/png');
      };

      img.onerror = () => reject(new Error("Failed to load image for processing via proxy."));
    });
  };

  async function handleScrape() {
    if (!name.trim() || !cardNumber.trim()) { setMsg("Card name and number required."); return; }
    setScraping(true);
    setMsg(`Scraping ${name} #${cardNumber}…`);
    setSetCode(""); setRarity(""); setPrice(""); setSel([]); setResults([]); setTerm(""); setHoloType(null);

    try {
      const r = await fetch(`/api/card/scrape?name=${encodeURIComponent(name)}&number=${encodeURIComponent(cardNumber)}`);
      const d: ScrapedCard = await handleApiResponse(r);
      setSetCode(d.set); setRarity(d.rarity ?? ""); setPrice(String(d.price));
      if (d.image_url) {
        setSel([{ url: d.image_url, source: "api", apiCardName: d.name, holoType: d.holo_type, file: null }]);
      }
      setTerm(d.name); setHoloType(d.holo_type);
      setMsg("Fields populated.");
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    finally { setScraping(false); }
  }

  async function handleScanPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';

    // Clear previous results so stale data doesn't linger
    setResults([]);
    setMsg('');

    // Add all files to queue immediately with preview
    const newItems: ScanQueueItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'scanning' as const,
    }));
    setScanQueue(prev => [...prev, ...newItems]);

    // Process each file
    for (const item of newItems) {
      try {
        const fd = new FormData();
        fd.append("image", item.file);
        const r = await fetch("/api/scan-card", { method: "POST", body: fd });
        const d = await r.json();
        if (d.error) throw new Error(d.error);

        const englishName = d.english_name ?? d.japanese_name ?? '';
        const cardNumber: string | undefined = d.card_number ?? undefined;
        const cardTotal: string | undefined = d.card_total ?? undefined;
        const detectedLanguage: string | undefined = d.language ?? undefined;

        // Search Pokemon TCG API — most specific first, fall back if needed
        const searchResults = await searchPokemonCard(englishName, cardNumber, cardTotal);
        const apiResults = searchResults.results;
        const searchQuery = searchResults.query;

        setScanQueue(prev => prev.map(i => i.id === item.id ? {
          ...i,
          status: 'done',
          japaneseName: d.japanese_name,
          englishName,
          cardNumber,
          cardTotal,
          language: detectedLanguage,
          apiResults,
          searchQuery,
        } : i));

        // Auto-load into main form so results appear immediately
        setName(englishName);
        setTerm(englishName);
        if (cardNumber) setNumber(cardNumber);
        if (detectedLanguage) setLanguage(detectedLanguage);
        setResults(apiResults);
        setMsg(
          apiResults.length
            ? `Found ${apiResults.length} match${apiResults.length > 1 ? 'es' : ''} for "${englishName}" — pick a version below.`
            : `No matches for "${englishName}" — edit the details in the queue and re-search.`
        );
      } catch (err: any) {
        setScanQueue(prev => prev.map(i => i.id === item.id ? {
          ...i,
          status: 'error',
          error: err.message,
        } : i));
      }
    }
  }

  function loadQueueItem(item: ScanQueueItem) {
    if (!item.englishName) return;
    setName(item.englishName);
    setTerm(item.englishName);
    if (item.cardNumber) setNumber(item.cardNumber);
    setResults(item.apiResults ?? []);
    const label = item.cardNumber
      ? `Loaded "${item.englishName}" #${item.cardNumber} — pick a version below.`
      : `Loaded "${item.englishName}" — pick a version below.`;
    setMsg(label);
  }

  function removeQueueItem(id: string) {
    setScanQueue(prev => prev.filter(i => i.id !== id));
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault(); if (!searchTerm.trim()) return;
    setSearching(true); setMsg(`Searching "${searchTerm}"…`);
    try {
      const r = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(searchTerm)}"&pageSize=10&orderBy=-set.releaseDate`);
      const j: PokemonTCGApiResponse = await handleApiResponse(r);
      setResults(j.data); setMsg(j.data.length ? `${j.data.length} cards found.` : "No results.");
    } catch (e:any) { setMsg(`Search error: ${e.message}`); }
    finally { setSearching(false); }
  }

  const pickImage = async (card: PokemonTCGCard, version: string, marketPrice: number | null) => {
    setMsg(`Loading ${card.name} (${version})...`);
    try {
      // Fetch the plain card image (no holo overlay)
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

      // Store set name + series for filtering
      if (card.set) {
        const setDisplay = card.set.series
          ? `${card.set.name} | ${card.set.series}`
          : card.set.name;
        setSetCode(setDisplay);
      }

      // Store number/total
      if (card.number) {
        const total = card.set?.printedTotal;
        setNumber(total ? `${card.number}/${total}` : card.number);
      }

      // Build a proper sellable title from all the data we have
      if (card.name) {
        const num = card.number ?? '';
        const total = card.set?.printedTotal ? `/${card.set.printedTotal}` : '';
        const setName = card.set?.name ?? '';
        const series = card.set?.series ? ` | ${card.set.series}` : '';
        const title = `${card.name}${num ? ` ${num}${total}` : ''} ${setName}${series}`.trim();
        setName(title);
      }
      setMsg(`${card.name} (${version}) selected.`);
    } catch (error: any) {
      setMsg(`Error loading image: ${error.message}`);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (!name || !cardNumber || (!files && !selectedImages.length)) { setMsg("Name, number & image required."); return; }
    const p = Number(price); if (isNaN(p) || p < 0) { setMsg("Price must be a non-negative number."); return; }

    setUploading(true);
    let finalImageUrl = '';
    let finalPublicId: string | undefined = undefined;

    try {
      const imageToUpload = selectedImages.length > 0 ? selectedImages[0].file : (files ? files[0] : null);
      if (!imageToUpload) throw new Error("No image file available to upload.");

      const fd = new FormData();
      fd.append("file", imageToUpload);
      const u = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, public_id } = await handleApiResponse(u);
      finalImageUrl = url;
      finalPublicId = public_id;

      const body = { name, number: cardNumber, price: p, set: setCode, rarity, image_url: finalImageUrl, scan_url: finalPublicId, available: true, language, holo_type: holoType };
      const res = await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to add card to the database.");
      }

      setMsg("Card added ✔︎");
      setName(""); setNumber(""); setSetCode(""); setRarity(""); setPrice(""); setFiles(null); setSel([]); setTerm(""); setResults([]); setHoloType(null); setLanguage("English");
      const fileInputElement = document.getElementById("file-input") as HTMLInputElement | null;
      if (fileInputElement) fileInputElement.value = "";
    } catch (e:any) { setMsg(`Error: ${e.message}`); }
    finally { setUploading(false); }
  }

  const styles = {
    formContainer: { maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: '#f9f9f9', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    formTitle: { textAlign: 'center' as const, color: '#333', marginBottom: '1.5rem' },
    flash: { padding: '1rem', marginBottom: '1rem', border: '1px solid', borderRadius: '4px', color: '#155724', backgroundColor: '#d4edda', borderColor: '#c3e6cb' },
    formGroup: { marginBottom: '1rem' },
    label: { display: 'block' as const, marginBottom: '0.5rem', color: '#555', fontWeight: 'bold' as const },
    inputField: { width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' as const },
    searchButton: { padding: '0.75rem 1.5rem', border: 'none', borderRadius: '4px', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' as const },
    searchResultsContainer: { border: '1px solid #eee', borderRadius: '4px', marginTop: '1rem' },
    searchResultItem: { display: 'flex', alignItems: 'flex-start', padding: '0.5rem', borderBottom: '1px solid #eee' },
    selectImageButton: { padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', backgroundColor: '#28a745', color: 'white', cursor: 'pointer' as const, width: '100%', boxSizing: 'border-box' as const },
    submitButton: { width: '100%', padding: '1rem', border: 'none', borderRadius: '4px', backgroundColor: '#28a745', color: 'white', cursor: 'pointer' as const, fontSize: '1.2rem' },
    fileInput: { padding: '0.5rem' }
  };

  const renderVersionButtons = (card: PokemonTCGCard) => {
    const prices = card.tcgplayer?.prices;
    if (!prices) return <button style={styles.selectImageButton} onClick={() => pickImage(card, 'Normal', null)}>Use Image</button>;

    const versions = Object.entries(prices)
      .map(([key, value]) => ({ name: key, price: value?.market }))
      .filter(v => v.price != null);

    if (versions.length === 0) return <button style={styles.selectImageButton} onClick={() => pickImage(card, 'Normal', null)}>Use Image</button>;

    return versions.map(version => {
      const displayName = version.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return (
        <button key={version.name} type="button" style={styles.selectImageButton} onClick={() => pickImage(card, displayName, version.price)}>
          {displayName} {version.price ? `($${version.price.toFixed(2)})` : ''}
        </button>
      );
    });
  };

  /* ── JSX ui ────────────────────────────────────────────── */
  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <form onSubmit={handleSubmit} style={styles.formContainer}>
        <h1 style={styles.formTitle}>Add New Card</h1>
        {msg && <div style={styles.flash}>{msg}</div>}

        <div style={styles.formGroup}><label style={styles.label}>Card Name</label><input style={styles.inputField} value={name} onChange={e=>setName(e.target.value)} required /></div>
        <div style={styles.formGroup}><label style={styles.label}>Card Number</label><input style={styles.inputField} value={cardNumber} onChange={e=>setNumber(e.target.value)} required /></div>
        <div style={styles.formGroup}><button type="button" style={styles.searchButton} onClick={handleScrape} disabled={scraping}>{scraping?"Scraping…":"Scrape Details"}</button></div>
        <div style={styles.formGroup}><label style={styles.label}>Price (pence)</label><input type="number" min="0" style={styles.inputField} value={price} onChange={e=>setPrice(e.target.value)} required /></div>
        <div style={styles.formGroup}><label style={styles.label}>Set Code</label><input style={styles.inputField} value={setCode} onChange={e=>setSetCode(e.target.value)} /></div>
        <div style={styles.formGroup}><label style={styles.label}>Rarity</label><input style={styles.inputField} value={rarity} onChange={e=>setRarity(e.target.value)} /></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Language</label>
          <select style={styles.inputField} value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
            <option value="Korean">Korean</option>
            <option value="Chinese">Chinese</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Spanish">Spanish</option>
          </select>
        </div>
        <div style={styles.formGroup}><label style={styles.label}>Holo Type</label><input style={styles.inputField} value={holoType ?? ''} onChange={e=>setHoloType(e.target.value)} /></div>

        <div style={styles.formGroup}>
          <label style={styles.label}>📷 Scan Physical Card Photos</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleScanPhotos}
            style={{...styles.inputField, ...styles.fileInput}}
          />
          {scanQueue.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scanQueue.map(item => (
                <div key={item.id} style={{
                  padding: '10px', border: '1px solid #ddd', borderRadius: 6,
                  background: item.status === 'error' ? '#fff0f0' : '#f9f9f9',
                }}>
                  {/* Top row: thumbnail + status + remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={item.previewUrl} alt="card" style={{ width: 50, height: 70, objectFit: 'cover', borderRadius: 4, border: '1px solid #ccc', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      {item.status === 'scanning' && <p style={{ margin: 0, color: '#888' }}>⏳ Scanning...</p>}
                      {item.status === 'error' && <p style={{ margin: 0, color: 'red', fontSize: 12 }}>❌ {item.error}</p>}
                      {item.status === 'done' && (
                        <p style={{ margin: 0, color: item.apiResults?.length ? '#007bff' : '#e67e22', fontSize: 12 }}>
                          {item.apiResults?.length ? `${item.apiResults.length} matches found` : 'No matches — fix the number below'}
                          {item.language && (
                            <span style={{ marginLeft: 6, background: item.language === 'Japanese' ? '#fff0f4' : '#f0f4ff', color: item.language === 'Japanese' ? '#c0392b' : '#2980b9', border: `1px solid ${item.language === 'Japanese' ? '#f5c6cb' : '#bee3f8'}`, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                              {item.language === 'Japanese' ? '🇯🇵 JP' : '🇬🇧 EN'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeQueueItem(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 16, padding: '0 4px', flexShrink: 0 }}>✕</button>
                  </div>

                  {/* Edit + search row */}
                  {item.status === 'done' && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      <input
                        placeholder="Name"
                        defaultValue={item.englishName ?? ''}
                        onChange={e => setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, englishName: e.target.value } : i))}
                        style={{ flex: '2 1 120px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
                      />
                      <input
                        placeholder="Num (e.g. 25)"
                        defaultValue={item.cardNumber ?? ''}
                        onChange={e => setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, cardNumber: e.target.value } : i))}
                        style={{ flex: '1 1 60px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
                      />
                      <input
                        placeholder="Total (e.g. 165)"
                        defaultValue={item.cardTotal ?? ''}
                        onChange={e => setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, cardTotal: e.target.value } : i))}
                        style={{ flex: '1 1 70px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
                      />
                      <button type="button"
                        style={{ padding: '4px 10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                        onClick={async () => {
                          setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'scanning' } : i));
                          const r = await searchPokemonCard(item.englishName ?? '', item.cardNumber, item.cardTotal);
                          setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done', apiResults: r.results, searchQuery: r.query } : i));
                        }}>
                        🔍 Re-search
                      </button>
                      <button type="button"
                        style={{ padding: '4px 10px', background: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                        onClick={() => loadQueueItem(item)}>
                        Load →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Search Pokémon Card Image (Optional)</label>
          <div style={{ display:"flex", gap:10 }}>
            <input style={styles.inputField} placeholder="Enter Pokémon name" value={searchTerm} onChange={e=>setTerm(e.target.value)} />
            <button type="button" style={styles.searchButton} onClick={handleSearch} disabled={searching || !searchTerm.trim()}>{searching?"Searching…":"Search API"}</button>
          </div>
        </div>

        {results.length > 0 && (
          <div style={styles.searchResultsContainer}>
            {results.map((card) => (
              <div key={card.id} style={styles.searchResultItem}>
                <img src={card.images.small} alt={card.name} width={60} height={84} style={{ imageRendering: "pixelated", border: "1px solid #ccc", flexShrink: 0 }} />
                <div style={{ flexGrow: 1, paddingLeft: 10, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold' }}>{card.name}</span>
                  {card.set && (
                    <span style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                      {card.set.name}{card.set.series ? ` | ${card.set.series}` : ''} · #{card.number}{card.set.printedTotal ? `/${card.set.printedTotal}` : ''}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px', alignItems: 'flex-start' }}>{renderVersionButtons(card)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedImages.length > 0 && (
          <div style={styles.formGroup}>
            <p style={styles.label}>Selected Images:</p>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {selectedImages.map((img, idx) => (
                <li key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={img.url} alt={img.apiCardName ?? "img"} width={40} height={56} style={{ imageRendering: "pixelated", border: "1px solid #ccc" }} />
                  <span>{img.apiCardName ?? "Upload"} {img.holoType ? `(${img.holoType})` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>Or Upload Your Own Image(s)</label>
          <input id="file-input" type="file" multiple accept="image/*" style={{...styles.inputField, ...styles.fileInput}} onChange={e=>setFiles(e.target.files)} />
        </div>

        <button style={styles.submitButton} type="submit" disabled={uploading}>{uploading?"Processing…":"Add Card"}</button>
      </form>
    </>
  );
}
