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
        // Even if scan fails, keep the photo so the user can upload it manually
        setSel([{ url: item.previewUrl, file: item.file, source: 'upload', apiCardName: 'Scanned photo', holoType: null }]);
        setMsg('Scan unavailable — your photo has been kept. Fill in the card name, number & price then click Add Card.');
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
        const setDisplayName = card.set?.name ?? '';
        const series = card.set?.series ? ` | ${card.set.series}` : '';
        const title = `${card.name}${num ? ` ${num}${total}` : ''} ${setDisplayName}${series}`.trim();
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

  /* ── Styles ────────────────────────────────────────────── */
  const styles = {
    formContainer: {
      maxWidth: '640px',
      margin: '2rem auto',
      padding: '2rem',
      background: '#1a1a2e',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid #2d2d4e',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    formTitle: {
      textAlign: 'center' as const,
      color: '#ffffff',
      marginBottom: '1.5rem',
      fontSize: '1.6rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      background: 'linear-gradient(90deg, #a78bfa, #7c6af0)',
      WebkitBackgroundClip: 'text' as const,
      WebkitTextFillColor: 'transparent' as const,
    },
    flash: {
      padding: '0.85rem 1rem',
      marginBottom: '1rem',
      borderRadius: '8px',
      color: '#d4edda',
      backgroundColor: '#1e3a2f',
      border: '1px solid #2d5a45',
      fontSize: '0.9rem',
    },
    formGroup: { marginBottom: '1rem' },
    label: {
      display: 'block' as const,
      marginBottom: '0.4rem',
      color: '#c4b5fd',
      fontWeight: 600,
      fontSize: '0.85rem',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    inputField: {
      width: '100%',
      padding: '0.65rem 0.85rem',
      border: '1px solid #3d3d6e',
      borderRadius: '8px',
      boxSizing: 'border-box' as const,
      background: '#0f0f1e',
      color: '#e2e8f0',
      fontSize: '0.95rem',
      outline: 'none',
      transition: 'border-color 0.2s',
    },
    searchButton: {
      padding: '0.65rem 1.25rem',
      border: 'none',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #7c6af0, #5b4dd4)',
      color: 'white',
      cursor: 'pointer' as const,
      fontWeight: 600,
      fontSize: '0.9rem',
      whiteSpace: 'nowrap' as const,
    },
    searchResultsContainer: {
      border: '1px solid #2d2d4e',
      borderRadius: '10px',
      marginTop: '1rem',
      overflow: 'hidden',
      background: '#12122a',
    },
    searchResultItem: {
      display: 'flex',
      alignItems: 'flex-start',
      padding: '0.75rem',
      borderBottom: '1px solid #2d2d4e',
      gap: '0.75rem',
    },
    selectImageButton: {
      padding: '0.4rem 0.85rem',
      border: '1px solid #7c6af0',
      borderRadius: '6px',
      background: 'transparent',
      color: '#a78bfa',
      cursor: 'pointer' as const,
      fontSize: '0.8rem',
      fontWeight: 600,
      boxSizing: 'border-box' as const,
      transition: 'background 0.15s, color 0.15s',
    },
    submitButton: {
      width: '100%',
      padding: '0.9rem',
      border: 'none',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, #7c6af0 0%, #5b4dd4 50%, #a78bfa 100%)',
      color: 'white',
      cursor: 'pointer' as const,
      fontSize: '1.1rem',
      fontWeight: 700,
      letterSpacing: '0.03em',
      boxShadow: '0 4px 15px rgba(124, 106, 240, 0.4)',
      marginTop: '0.5rem',
    },
    fileInput: {
      padding: '0.5rem',
      color: '#c4b5fd',
    },
    sectionDivider: {
      border: 'none',
      borderTop: '1px solid #2d2d4e',
      margin: '1.5rem 0',
    },
  };

  const renderVersionButtons = (card: PokemonTCGCard) => {
    const prices = card.tcgplayer?.prices;
    if (!prices) return (
      <button
        style={styles.selectImageButton}
        onClick={() => pickImage(card, 'Normal', null)}
      >
        Use Image
      </button>
    );

    const versions = Object.entries(prices)
      .map(([key, value]) => ({ name: key, price: value?.market }))
      .filter(v => v.price != null);

    if (versions.length === 0) return (
      <button
        style={styles.selectImageButton}
        onClick={() => pickImage(card, 'Normal', null)}
      >
        Use Image
      </button>
    );

    return versions.map(version => {
      const displayName = version.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return (
        <button
          key={version.name}
          type="button"
          style={styles.selectImageButton}
          onClick={() => pickImage(card, displayName, version.price)}
        >
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

        {msg && (
          <div style={{
            ...styles.flash,
            ...(msg.startsWith('Error') ? { background: '#3a1a1a', borderColor: '#7a3535', color: '#fca5a5' } : {}),
            ...(msg.includes('✔') ? { background: '#1a3a2a', borderColor: '#2d7a50', color: '#86efac' } : {}),
          }}>
            {msg}
          </div>
        )}

        {/* Card Name & Number */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Card Name</label>
          <input
            style={styles.inputField}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Charizard"
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Card Number</label>
            <input
              style={styles.inputField}
              value={cardNumber}
              onChange={e => setNumber(e.target.value)}
              placeholder="e.g. 4/102"
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              style={{ ...styles.searchButton, padding: '0.65rem 1rem' }}
              onClick={handleScrape}
              disabled={scraping}
            >
              {scraping ? 'Scraping…' : 'Scrape Details'}
            </button>
          </div>
        </div>

        {/* Price, Set, Rarity */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Price (pence)</label>
            <input
              type="number"
              min="0"
              style={styles.inputField}
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 499"
              required
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={styles.label}>Set</label>
            <input
              style={styles.inputField}
              value={setCode}
              onChange={e => setSetCode(e.target.value)}
              placeholder="e.g. Base Set | Base"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Rarity</label>
            <input
              style={styles.inputField}
              value={rarity}
              onChange={e => setRarity(e.target.value)}
              placeholder="e.g. Holo Rare"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Language</label>
            <select
              style={{ ...styles.inputField }}
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              <option value="English">English</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Chinese">Chinese</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Spanish">Spanish</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Holo Type</label>
            <input
              style={styles.inputField}
              value={holoType ?? ''}
              onChange={e => setHoloType(e.target.value)}
              placeholder="e.g. Holo"
            />
          </div>
        </div>

        <hr style={styles.sectionDivider} />

        {/* Scan Queue */}
        <div style={styles.formGroup}>
          <label style={styles.label}>📷 Scan Physical Card Photos</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleScanPhotos}
            style={{
              ...styles.inputField,
              ...styles.fileInput,
              cursor: 'pointer',
            }}
          />

          {scanQueue.length > 0 && (
            <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {scanQueue.map(item => (
                <div
                  key={item.id}
                  style={{
                    background: '#12122a',
                    border: `1px solid ${item.status === 'error' ? '#7a3535' : item.status === 'scanning' ? '#3d3d6e' : '#2d2d4e'}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Card header row */}
                  <div style={{ display: 'flex', gap: '0.85rem', padding: '0.85rem' }}>
                    {/* Thumbnail */}
                    <img
                      src={item.previewUrl}
                      alt="card"
                      style={{
                        width: 80,
                        height: 112,
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: '1px solid #3d3d6e',
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}
                    />

                    {/* Info column */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {/* Card name + remove button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{
                          color: '#e2e8f0',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap' as const,
                        }}>
                          {item.englishName || item.file.name || 'Scanning…'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQueueItem(item.id)}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid #3d3d6e',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            fontSize: '0.8rem',
                            padding: '2px 8px',
                            flexShrink: 0,
                            lineHeight: 1.4,
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      {/* Status badge */}
                      {item.status === 'scanning' && (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          background: '#1e2a4a',
                          color: '#93c5fd',
                          border: '1px solid #3b5a8a',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}>
                          ⏳ Scanning…
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          background: '#3a1a1a',
                          color: '#fca5a5',
                          border: '1px solid #7a3535',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}>
                          ✗ {item.error ?? 'Scan failed'}
                        </span>
                      )}
                      {item.status === 'done' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' as const }}>
                          {item.apiResults?.length ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              background: '#1a3a2a',
                              color: '#86efac',
                              border: '1px solid #2d7a50',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                            }}>
                              ✓ {item.apiResults.length} match{item.apiResults.length > 1 ? 'es' : ''}
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              background: '#3a1a1a',
                              color: '#fca5a5',
                              border: '1px solid #7a3535',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                            }}>
                              ✗ No matches
                            </span>
                          )}
                          {item.language && (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              background: item.language === 'Japanese' ? '#3a1a2a' : '#1a1a3a',
                              color: item.language === 'Japanese' ? '#f9a8d4' : '#93c5fd',
                              border: `1px solid ${item.language === 'Japanese' ? '#7a3560' : '#3b5a8a'}`,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}>
                              {item.language === 'Japanese' ? '🇯🇵 JP' : '🇬🇧 EN'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Number / Total info */}
                      {item.status === 'done' && (item.cardNumber || item.cardTotal) && (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                          {item.cardNumber && `#${item.cardNumber}`}{item.cardTotal && ` / ${item.cardTotal}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit + action panel (only when done) */}
                  {item.status === 'done' && (
                    <div style={{
                      borderTop: '1px solid #2d2d4e',
                      padding: '0.75rem 0.85rem',
                      background: '#0f0f1e',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input
                          placeholder="Card name"
                          defaultValue={item.englishName ?? ''}
                          onChange={e => setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, englishName: e.target.value } : i))}
                          style={{
                            ...styles.inputField,
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.85rem',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            placeholder="Card # (e.g. 25)"
                            defaultValue={item.cardNumber ?? ''}
                            onChange={e => setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, cardNumber: e.target.value } : i))}
                            style={{
                              ...styles.inputField,
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.85rem',
                              flex: 1,
                            }}
                          />
                          <input
                            placeholder="Set total (e.g. 165)"
                            defaultValue={item.cardTotal ?? ''}
                            onChange={e => setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, cardTotal: e.target.value } : i))}
                            style={{
                              ...styles.inputField,
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.85rem',
                              flex: 1,
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'transparent',
                            border: '1px solid #3d3d6e',
                            borderRadius: '7px',
                            color: '#c4b5fd',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                          onClick={async () => {
                            setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'scanning' } : i));
                            const r = await searchPokemonCard(item.englishName ?? '', item.cardNumber, item.cardTotal);
                            setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done', apiResults: r.results, searchQuery: r.query } : i));
                          }}
                        >
                          🔍 Re-search
                        </button>
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'linear-gradient(135deg, #7c6af0, #5b4dd4)',
                            border: 'none',
                            borderRadius: '7px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            boxShadow: '0 2px 8px rgba(124,106,240,0.35)',
                          }}
                          onClick={() => loadQueueItem(item)}
                        >
                          Load into Form →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <hr style={styles.sectionDivider} />

        {/* API Search */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Search Pokémon Card Image (Optional)</label>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <input
              style={{ ...styles.inputField, flex: 1 }}
              placeholder="Enter Pokémon name"
              value={searchTerm}
              onChange={e => setTerm(e.target.value)}
            />
            <button
              type="button"
              style={styles.searchButton}
              onClick={handleSearch}
              disabled={searching || !searchTerm.trim()}
            >
              {searching ? 'Searching…' : 'Search API'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div style={styles.searchResultsContainer}>
            {results.map((card) => (
              <div key={card.id} style={styles.searchResultItem}>
                <img
                  src={card.images.small}
                  alt={card.name}
                  width={60}
                  height={84}
                  style={{
                    imageRendering: 'pixelated',
                    border: '1px solid #3d3d6e',
                    borderRadius: '6px',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flexGrow: 1, paddingLeft: 4, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.95rem' }}>{card.name}</span>
                  {card.set && (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      {card.set.name}{card.set.series ? ` | ${card.set.series}` : ''} · #{card.number}{card.set.printedTotal ? `/${card.set.printedTotal}` : ''}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.4rem', marginTop: '0.25rem', alignItems: 'flex-start' }}>
                    {renderVersionButtons(card)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div style={{ ...styles.formGroup, marginTop: '1rem' }}>
            <label style={styles.label}>Selected Image</label>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              background: '#0f0f1e',
              borderRadius: '8px',
              border: '1px solid #2d2d4e',
              padding: '0.75rem',
            }}>
              {selectedImages.map((img, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src={img.url}
                    alt={img.apiCardName ?? 'img'}
                    width={50}
                    height={70}
                    style={{
                      imageRendering: 'pixelated',
                      border: '1px solid #3d3d6e',
                      borderRadius: '5px',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    }}
                  />
                  <div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
                      {img.apiCardName ?? 'Upload'}
                    </div>
                    {img.holoType && (
                      <div style={{ color: '#a78bfa', fontSize: '0.8rem' }}>{img.holoType}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <hr style={styles.sectionDivider} />

        {/* Manual Upload */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Or Upload Your Own Image</label>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            style={{ ...styles.inputField, ...styles.fileInput, cursor: 'pointer' }}
            onChange={e => {
              setFiles(e.target.files);
              if (e.target.files?.length) setMsg(`Image ready — fill in card name, number & price then click Add Card.`);
            }}
          />
          {files && files.length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#86efac' }}>
              ✔ {files[0].name} selected
            </p>
          )}
        </div>

        <button
          style={{
            ...styles.submitButton,
            opacity: uploading ? 0.7 : 1,
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
          type="submit"
          disabled={uploading}
        >
          {uploading ? '⏳ Processing…' : '✦ Add Card'}
        </button>
      </form>
    </>
  );
}
