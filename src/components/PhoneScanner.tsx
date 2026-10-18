'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import CardCondition from './CardCondition';
import DuplicateCheck from './DuplicateCheck';
import ScannerDefaults,{readScannerPreset} from './ScannerDefaults';
import ConditionSuggestion from './ConditionSuggestion';
import { CARD_EDITIONS, isCardEdition } from '@/lib/card-edition';
import { isCardCondition } from '@/lib/card-condition';
import styles from './PhoneScanner.module.css';
import {scannerLookupPayload,scannerPriceAfterLookup} from '@/lib/scanner-lookup';
import {matchingPrinting} from '@/lib/inventory-refresh';
import { prepareCardPhoto } from '@/lib/card-photo';
import ScanReview from './ScanReview';
import {printedCardNumber,type ScanNotes} from '@/lib/scan-notes';
import GradingFields from './GradingFields';
import { completeGrading, type Grading } from '@/lib/card-grading';

type Details = { name: string; number: string; set: string; rarity: string; language: string; holo_type: string; price: string; condition: string; edition: string };
type Enrichment = { illustrator?:string|null; edition?: string | null; image_url?: string | null; name?: string; matched?: boolean; catalog_id?: string; set?: string; rarity?: string; holo_type?: string | null; notice?: string; candidates?: { id: string; name: string; set: string; number: string; rarity?: string }[]; pricing?: { gbp: string; source: string; updated: string; original: number; currency: string; rate_date: string; url?: string } | null };
const blank: Details = { name: '', number: '', set: '', rarity: '', language: 'English', holo_type: '', price: '', condition: '', edition: '' };
async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'The request failed. Please try again.');
  return data;
}

export default function PhoneScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [backPhoto,setBackPhoto]=useState<File|null>(null);
  const [backUpload,setBackUpload]=useState<{url:string;public_id:string}|null>(null);
  const clientId=useRef('');
  const [details, setDetails] = useState<Details>(blank);
  const [notes,setNotes]=useState<ScanNotes|null>(null);
  const [grading,setGrading]=useState<Grading|null>(null);
  function changeGrading(value:Grading|null){const changed=value?.company!==grading?.company||value?.grade!==grading?.grade||value?.cert_number!==grading?.cert_number||!!value!==!!grading;setGrading(value);if(changed){setDetails(prev=>({...prev,price:''}));setEnrichment(prev=>prev?{...prev,pricing:null}:null);setLookupMessage('');}}
  const [stage, setStage] = useState<'capture' | 'scanning' | 'review' | 'saving' | 'saved'>('capture');
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [usePhoto, setUsePhoto] = useState(false);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [originalName, setOriginalName] = useState('');
  const [printedTotal,setPrintedTotal]=useState('');
  const [lookupMessage,setLookupMessage]=useState('');
  const [lookupError,setLookupError]=useState('');
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
    if(key!=='condition')setGrading(prev=>prev?{...prev,confirmed:false}:null);
    const identityChanged = ['name','number','language'].includes(key);
    setDetails(prev => ({ ...prev, ...(identityChanged ? { set: '', rarity: '', price: '', holo_type: '' } : {}), ...(['set','holo_type','edition'].includes(key) ? { price: '' } : {}), [key]: value }));
    setLookupMessage('');setLookupError('');
    if (identityChanged) { setNotes(null);setOriginalName(''); setPrintedTotal(''); setEnrichment(null); }
    else if (['set','holo_type','edition'].includes(key)) setEnrichment(prev => prev ? { ...prev, ...(['set','edition'].includes(key) ? { image_url: null, ...(key==='set'?{catalog_id:undefined}:{}) } : {}), pricing: null, notice: 'Details changed. Look up the card again to refresh its suggested price.' } : null);
  }
  function applyMetadata(data: Enrichment) {
    setGrading(prev=>prev?{...prev,confirmed:false}:null);
    setEnrichment(data); setUsePhoto(false);
    if (data.matched) setDetails(prev => ({ ...prev, edition: data.edition === undefined ? prev.edition : data.edition || '', name: data.name || prev.name, set: data.set || '', rarity: data.rarity || '', holo_type: data.holo_type || prev.holo_type, price: scannerPriceAfterLookup(prev.price,!!data.matched,data.pricing) }));
  }
  async function lookup(catalog_id?: string) {
    if(busy)return;
    setLookingUp(true);setLookupMessage('');setLookupError('');setError('');
    try {
      async function request(id?:string):Promise<Enrichment>{return readResponse(await fetch('/api/card-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...scannerLookupPayload(details,originalName,printedTotal,id),grading})}));}
      let data=await request(catalog_id||enrichment?.catalog_id);
      if(!data.matched&&!catalog_id){const chosen=matchingPrinting({matched:false,candidates:data.candidates},details.set);if(chosen)data=await request(chosen);}
      applyMetadata(data);
      setLookupMessage(data.pricing?`Suggested £${data.pricing.gbp} filled into the price field. Check it against the card’s condition.`:(data.notice||'No reliable price was found. Check the matching set, finish and edition, or enter a price manually.')+(details.price?' Your entered price was kept.':''));
    }catch(error){setLookupError(error instanceof Error?error.message:'Lookup failed. Please retry.');}
    finally{setLookingUp(false);}
  }
  async function scan(photo: File | undefined) {
    if (!photo || busy) return;
    setError('');setNotes(null);setGrading(null);setPrintedTotal('');setLookupMessage('');setLookupError('');
    clientId.current=crypto.randomUUID();setBackPhoto(null);setBackUpload(null);setFile(null); setUploadedPhoto(null); setDetails(blank); setEnrichment(null); setOriginalName(''); setStage('scanning');
    let preparedPhoto: File | null = null;
    try {
      const prepared = await prepareCardPhoto(photo);
      preparedPhoto = prepared;
      setFile(prepared);
      const body = new FormData(); body.append('image', prepared);
      const result = await readResponse(await fetch('/api/scan-card', { method: 'POST', body }));
      setGrading(result.grading||null);setNotes(result.scan_notes||null);
      setDetails({ ...blank, name: result.english_name || '', set:result.scan_notes?.label_set||'', number: printedCardNumber(result.card_number,result.card_total), language: result.language || readScannerPreset().language, holo_type:readScannerPreset().finish, edition: result.edition || '' });
      setOriginalName(result.original_name || '');
      setPrintedTotal(result.card_total||'');
      applyMetadata(result.enrichment || {});
    } catch (err) { setError(err instanceof Error ? err.message : 'Scan failed. Enter the details below or try another photo.'); }
    finally { setStage(preparedPhoto ? 'review' : 'capture'); }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!file || busy) return;
    if (!isCardEdition(details.edition)) { setError('Check and choose the card edition before saving.'); return; }
    if (grading && (!completeGrading(grading)||!grading.confirmed)) {setError('Confirm the slab label details before saving.');return;}
    if (!grading && !isCardCondition(details.condition)) { setError('Choose the card condition after checking the front and back.'); return; }
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
      let uploadedBack=backUpload;if(backPhoto&&!uploadedBack){const body=new FormData();body.append('file',backPhoto);uploadedBack=await readResponse(await fetch('/api/upload',{method:'POST',body}));setBackUpload(uploadedBack);}
      await readResponse(await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...details, grading, client_id:clientId.current,front_image_url:upload.url,back_image_url:uploadedBack?.url||null,price, image_url: !grading && !usePhoto && enrichment?.matched && enrichment.image_url ? enrichment.image_url : upload.url, scan_url: upload.public_id, available: published }) }));
      setStage('saved');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this card.'); setStage('review'); }
  }
  function reset() { setNotes(null);setGrading(null);setFile(null); setUploadedPhoto(null); setDetails(blank); setEnrichment(null); setOriginalName(''); setStage('capture'); setPrintedTotal('');setLookupMessage('');setLookupError('');setError(''); setPublished(false); }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/admin">← Seller studio</Link><span>GAY RETRO / SCANNER</span></header>
    <p className={styles.eyebrow}>From camera to collection</p><h1>Meet your next<br /><em>listing.</em></h1>
    <p className={styles.intro}>Take a clear photo of the front, including the full label for graded slabs. We’ll look up its set, rarity and suggested price. You check the match and condition.</p>
    <details className={styles.install}><summary>Add this app to your phone</summary><p>On iPhone: open this page in Safari, tap Share, then Add to Home Screen. On Android: open it in Chrome, open the browser menu, then choose Install app or Add to Home screen. An internet connection is required to scan and save.</p></details>
    <ol className={styles.steps} aria-label="Listing progress"><li aria-current={stage === 'capture' || stage === 'scanning' ? 'step' : undefined}>01 Photograph</li><li aria-current={stage === 'review' || stage === 'saving' ? 'step' : undefined}>02 Review</li><li aria-current={stage === 'saved' ? 'step' : undefined}>03 Save</li></ol>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <ScannerDefaults/>
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
        <fieldset className={styles.reviewFields} disabled={lookingUp||stage==='saving'}><h2>Review your card</h2><p className={styles.note}>AI can misread names and numbers. Check the card, language and finish before publishing. Matched catalogue artwork becomes the listing image; your actual front and any back photos are also included for buyers.</p>
        {enrichment?.notice && <p className={styles.note} role="status">{enrichment.notice}</p>}
        {enrichment?.candidates?.map(candidate => <button className={styles.secondary} type="button" key={candidate.id} disabled={busy} onClick={() => void lookup(candidate.id)}>{candidate.name} · {candidate.set} · #{candidate.number}</button>)}
        {!grading && enrichment?.matched && enrichment.image_url ? <div><p className={styles.note}>Catalogue artwork — check that it matches your card.</p><img src={enrichment.image_url} alt="Matched catalogue card artwork" width={150} height={206} style={{objectFit:"contain"}} onError={() => setEnrichment(prev => prev ? {...prev,image_url:null} : prev)} /><label className={styles.check}><input type="checkbox" checked={usePhoto} onChange={e => setUsePhoto(e.target.checked)} />Use my photo instead</label></div> : <p className={styles.note}>Your actual card or slab photo will be used.</p>}
        <ScanReview notes={notes} illustrator={enrichment?.illustrator}/>
        <GradingFields value={grading} card={{name:details.name,number:details.number,set:details.set}} onChange={changeGrading}/>
        <label>Card name<input required maxLength={200} value={details.name} onChange={e => field('name', e.target.value)} /></label>
        <div className={styles.fields}><label>Card number<input required maxLength={40} value={details.number} onChange={e => field('number', e.target.value)} /></label><label>Price (£)<input required type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" value={details.price} onChange={e => field('price', e.target.value)} /></label></div>
        <label>Set<input maxLength={160} placeholder="Check the set printed on your card" value={details.set} onChange={e => field('set', e.target.value)} /></label>
        <label>Rarity<input maxLength={100} placeholder="Filled from the matching catalogue card" value={details.rarity} onChange={e => field('rarity', e.target.value)} /></label>
        <button className={styles.secondary} type="button" disabled={busy || !details.name || !details.number} onClick={() => void lookup()}>{lookingUp ? 'Looking up set and price…' : 'Look up set, rarity & price'}</button>
        <div className={styles.lookupResult} aria-live="polite">{lookingUp?<p role="status">Looking up the matching printing and price…</p>:lookupError?<p role="alert">{lookupError} Your details are still here; try again.</p>:lookupMessage?<p role="status">{lookupMessage}</p>:null}</div>
        {enrichment?.pricing && <p className={styles.note}><strong>Suggested £{enrichment.pricing.gbp}</strong> · {enrichment.pricing.source}<br />Market data: {enrichment.pricing.updated.slice(0,10)}{(!grading||enrichment.pricing.currency!=='GBP')&&<> · {enrichment.pricing.original} {enrichment.pricing.currency} converted to GBP using rates dated {enrichment.pricing.rate_date}.</>}<br />{grading?'Evidence for this exact grader and full grade. Check the source and choose your listing price.':'Market guide for this variant. Adjust for wear before listing.'}{enrichment.pricing.url&&<> <a href={enrichment.pricing.url} target="_blank" rel="noopener noreferrer">View price source ↗</a></>}</p>}
        <div className={styles.fields}><label>Language<select value={details.language} onChange={e => field('language', e.target.value)}>{['English','Japanese','Korean'].map(v => <option key={v}>{v}</option>)}</select></label><label>Finish<select value={details.holo_type} onChange={e => field('holo_type', e.target.value)}><option value="">Confirm finish</option>{[...new Set([details.holo_type,'Normal','Reverse Holo','Holo Rare','Rare Holo EX','Rare Holo GX','Double Rare','Ultra Rare','Full Art','Alt Art','Illustration Rare','Special Illustration Rare','Hyper Rare','Shiny Rare','Shiny Ultra Rare','Radiant Rare','Pokeball Holo','Master Ball Holo','Cosmos Holo','Promo'])].filter(Boolean).map(v => <option key={v}>{v}</option>)}</select></label></div>
        <label>Edition<select required value={details.edition} onChange={e=>field('edition',e.target.value)}><option value="">Check edition</option>{CARD_EDITIONS.map(v=><option key={v}>{v}</option>)}</select></label>
        {!grading && file && <><DuplicateCheck name={details.name} number={details.number} set={details.set} language={details.language}/><ConditionSuggestion onBackPhoto={photo=>{setBackPhoto(photo);setBackUpload(null);}} key={preview} front={file} disabled={busy} onBusy={setConditionBusy} onInvalidate={() => field('condition', '')} onConfirm={value => field('condition', value)} /></>}
        {!grading && <CardCondition value={details.condition} onChange={value => field('condition', value)} disabled={busy} />}
        <label className={styles.check}><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> List in the shop immediately</label><p className={styles.note}>Leave unchecked to keep the card off the storefront. Check the physical condition before listing for sale.</p>
        <button disabled={busy} type="submit">{stage === 'saving' ? 'Saving your card…' : published ? 'Publish card ↗' : 'Save draft ↗'}</button></fieldset>
      </form>}
    </div>}
  </main>;
}
