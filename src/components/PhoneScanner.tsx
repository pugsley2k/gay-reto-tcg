'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import CardCondition from './CardCondition';
import ConditionSuggestion from './ConditionSuggestion';
import { isCardCondition } from '@/lib/card-condition';
import styles from './PhoneScanner.module.css';
import { prepareCardPhoto } from '@/lib/card-photo';

type Details = { name: string; number: string; set: string; rarity: string; language: string; holo_type: string; price: string; condition: string };
type Enrichment = { image_url?: string | null; name?: string; matched?: boolean; catalog_id?: string; set?: string; rarity?: string; holo_type?: string | null; notice?: string; candidates?: { id: string; name: string; set: string; number: string; rarity?: string }[]; pricing?: { gbp: string; source: string; updated: string; original: number; currency: string; rate_date: string } | null };
const blank: Details = { name: '', number: '', set: '', rarity: '', language: 'English', holo_type: '', price: '', condition: '' };
async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'The request failed. Please try again.');
  return data;
}

export default function PhoneScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [details, setDetails] = useState<Details>(blank);
  const [stage, setStage] = useState<'capture' | 'scanning' | 'review' | 'saving' | 'saved'>('capture');
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [usePhoto, setUsePhoto] = useState(false);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [originalName, setOriginalName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [conditionBusy, setConditionBusy] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<{ url: string; public_id: string } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const busy = stage === 'scanning' || stage === 'saving' || lookingUp || conditionBusy;
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function field(key: keyof Details, value: string) {
    const identityChanged = ['name','number','language'].includes(key);
    setDetails(prev => ({ ...prev, ...(identityChanged ? { set: '', rarity: '', price: '', holo_type: '' } : {}), ...(['set','holo_type'].includes(key) ? { price: '' } : {}), [key]: value }));
    if (identityChanged) { setOriginalName(''); setEnrichment(null); }
    else if (['set','holo_type'].includes(key)) setEnrichment(prev => prev ? { ...prev, ...(key === 'set' ? { image_url: null } : {}), pricing: null, notice: 'Details changed. Look up the card again to refresh its suggested price.' } : null);
  }
  function applyMetadata(data: Enrichment) {
    setEnrichment(data); setUsePhoto(false);
    if (data.matched) setDetails(prev => ({ ...prev, name: data.name || prev.name, set: data.set || '', rarity: data.rarity || '', holo_type: data.holo_type || '', price: data.pricing?.gbp || '' }));
  }
  async function lookup(catalog_id?: string) {
    setLookingUp(true); setError('');
    try { applyMetadata(await readResponse(await fetch('/api/card-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...details, original_name: originalName || details.name, finish: details.holo_type, catalog_id }) }))); }
    catch (error) { setError(error instanceof Error ? error.message : 'Lookup failed.'); }
    finally { setLookingUp(false); }
  }
  async function scan(photo: File | undefined) {
    if (!photo || busy) return;
    setError('');
    setFile(null); setUploadedPhoto(null); setDetails(blank); setEnrichment(null); setOriginalName(''); setStage('scanning');
    let preparedPhoto: File | null = null;
    try {
      const prepared = await prepareCardPhoto(photo);
      preparedPhoto = prepared;
      setFile(prepared);
      const body = new FormData(); body.append('image', prepared);
      const result = await readResponse(await fetch('/api/scan-card', { method: 'POST', body }));
      setDetails({ ...blank, name: result.english_name || '', number: result.card_number || '', language: result.language || 'English' });
      setOriginalName(result.original_name || '');
      applyMetadata(result.enrichment || {});
    } catch (err) { setError(err instanceof Error ? err.message : 'Scan failed. Enter the details below or try another photo.'); }
    finally { setStage(preparedPhoto ? 'review' : 'capture'); }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!file || busy) return;
    if (!isCardCondition(details.condition)) { setError('Choose the card condition after checking the front and back.'); return; }
    const price = Math.round(Number(details.price) * 100);
    if (!details.name.trim() || !details.number.trim() || !details.price.trim() || !Number.isSafeInteger(price) || price < 1) {
      setError('Add a name, card number and price of at least £0.01.'); return;
    }
    setStage('saving'); setError('');
    try {
      let upload = uploadedPhoto;
      if (!upload) {
        const body = new FormData(); body.append('file', file);
        upload = await readResponse(await fetch('/api/upload', { method: 'POST', body }));
        setUploadedPhoto(upload);
      }
      if (!upload?.url) throw new Error('The photo upload did not finish. Please try again.');
      await readResponse(await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...details, price, image_url: !usePhoto && enrichment?.matched && enrichment.image_url ? enrichment.image_url : upload.url, scan_url: upload.public_id, available: published }) }));
      setStage('saved');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this card.'); setStage('review'); }
  }
  function reset() { setFile(null); setUploadedPhoto(null); setDetails(blank); setEnrichment(null); setOriginalName(''); setStage('capture'); setError(''); setPublished(false); }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/admin">← Seller studio</Link><span>GAY RETRO / SCANNER</span></header>
    <p className={styles.eyebrow}>From camera to collection</p><h1>Meet your next<br /><em>listing.</em></h1>
    <p className={styles.intro}>Take a clear photo of the front. We’ll look up its set, rarity and suggested price. You check the match and condition.</p>
    <details className={styles.install}><summary>Add this app to your phone</summary><p>On iPhone: open this page in Safari, tap Share, then Add to Home Screen. On Android: open it in Chrome, open the browser menu, then choose Install app or Add to Home screen. An internet connection is required to scan and save.</p></details>
    <ol className={styles.steps} aria-label="Listing progress"><li aria-current={stage === 'capture' || stage === 'scanning' ? 'step' : undefined}>01 Photograph</li><li aria-current={stage === 'review' || stage === 'saving' ? 'step' : undefined}>02 Review</li><li aria-current={stage === 'saved' ? 'step' : undefined}>03 Save</li></ol>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className={styles.hidden} onChange={e => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className={styles.hidden} onChange={e => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
    {stage === 'saved' ? <section className={styles.success} aria-live="polite"><span>✓</span><h2>{published ? 'Your card is in the shop.' : 'Draft saved.'}</h2><p>{details.name} · £{Number(details.price).toFixed(2)}</p><button onClick={reset}>Scan another card ↗</button><Link href={published ? '/shop' : '/admin'}>{published ? 'View the shop' : 'Manage your cards'}</Link></section> : <div className={styles.workspace}>
      <section className={styles.capture}>
        {preview ? <img src={preview} alt="Your card photograph for review" /> : <div className={styles.frame}><span aria-hidden="true">＋</span><p>One card. All four corners.<br />Good light, no glare.</p></div>}
        <button type="button" disabled={busy} onClick={() => camera.current?.click()}>{stage === 'scanning' ? 'Reading your card…' : file ? 'Retake photo' : 'Take a photo ↗'}</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => gallery.current?.click()}>Choose from photos</button>
        <p className={styles.note}>Photos are sent to OpenAI for identification. Saved card photos are uploaded to the store’s image host.</p>
      </section>
      {(stage === 'review' || stage === 'saving') && <form onSubmit={save} className={styles.form}>
        <h2>Review your card</h2><p className={styles.note}>AI can misread names and numbers. Check the card, language and finish before publishing. Matched catalogue artwork becomes the listing image; your photo is kept as a reference.</p>
        {enrichment?.notice && <p className={styles.note} role="status">{enrichment.notice}</p>}
        {enrichment?.candidates?.map(candidate => <button className={styles.secondary} type="button" key={candidate.id} disabled={busy} onClick={() => void lookup(candidate.id)}>{candidate.name} · {candidate.set} · #{candidate.number}</button>)}
        {enrichment?.matched && enrichment.image_url ? <div><p className={styles.note}>Catalogue artwork — check that it matches your card.</p><img src={enrichment.image_url} alt="Matched catalogue card artwork" width={150} height={206} style={{objectFit:"contain"}} onError={() => setEnrichment(prev => prev ? {...prev,image_url:null} : prev)} /><label className={styles.check}><input type="checkbox" checked={usePhoto} onChange={e => setUsePhoto(e.target.checked)} />Use my photo instead</label></div> : <p className={styles.note}>No catalogue image available. Your photo will be used.</p>}
        <label>Card name<input required maxLength={200} value={details.name} onChange={e => field('name', e.target.value)} /></label>
        <div className={styles.fields}><label>Card number<input required maxLength={40} value={details.number} onChange={e => field('number', e.target.value)} /></label><label>Price (£)<input required type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" value={details.price} onChange={e => field('price', e.target.value)} /></label></div>
        <label>Set<input maxLength={160} placeholder="Check the set printed on your card" value={details.set} onChange={e => field('set', e.target.value)} /></label>
        <label>Rarity<input maxLength={100} placeholder="Filled from the matching catalogue card" value={details.rarity} onChange={e => field('rarity', e.target.value)} /></label>
        <button className={styles.secondary} type="button" disabled={busy || !details.name || !details.number} onClick={() => void lookup()}>{lookingUp ? 'Looking up set and price…' : 'Look up set, rarity & price'}</button>
        {enrichment?.pricing && <p className={styles.note}><strong>Suggested £{enrichment.pricing.gbp}</strong> · {enrichment.pricing.source}<br />Market data: {enrichment.pricing.updated.slice(0,10)} · {enrichment.pricing.original} {enrichment.pricing.currency} converted to GBP using rates dated {enrichment.pricing.rate_date}.<br />Market guide for this variant, not a condition appraisal or a UK sold-price guarantee. Adjust for wear before listing.</p>}
        <div className={styles.fields}><label>Language<select value={details.language} onChange={e => field('language', e.target.value)}>{['English','Japanese','Korean'].map(v => <option key={v}>{v}</option>)}</select></label><label>Finish<select value={details.holo_type} onChange={e => field('holo_type', e.target.value)}><option value="">Confirm finish</option>{[...new Set([details.holo_type,'Normal','Reverse Holo','Holo Rare','Rare Holo EX','Rare Holo GX','Double Rare','Ultra Rare','Full Art','Alt Art','Illustration Rare','Special Illustration Rare','Hyper Rare','Shiny Rare','Shiny Ultra Rare','Radiant Rare','Pokeball Holo','Master Ball Holo','Cosmos Holo','Promo'])].filter(Boolean).map(v => <option key={v}>{v}</option>)}</select></label></div>
        {file && <ConditionSuggestion key={preview} front={file} disabled={busy} onBusy={setConditionBusy} onInvalidate={() => field('condition', '')} onConfirm={value => field('condition', value)} />}
        <CardCondition value={details.condition} onChange={value => field('condition', value)} disabled={busy} />
        <label className={styles.check}><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> List in the shop immediately</label><p className={styles.note}>Leave unchecked to keep the card off the storefront. Check the physical condition before listing for sale.</p>
        <button disabled={busy} type="submit">{stage === 'saving' ? 'Saving your card…' : published ? 'Publish card ↗' : 'Save draft ↗'}</button>
      </form>}
    </div>}
  </main>;
}
