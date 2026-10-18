'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {PROMO_SECONDS,type CardPromo,type PromoStyle} from '@/lib/card-promo';
import {drawCardPromo,loadPromoImage,promoRecordingType,recordCardPromo,PROMO_WIDTH,PROMO_HEIGHT} from '@/lib/card-promo-renderer';
import styles from './CardPromoStudio.module.css';
type Draft={card_id:string;revision:number;state:string;updated_at:string;Card:{name:string;price:number}|null};
async function responseJson(response:Response){const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load card promos.');return data;}
export default function CardPromoStudio(){
  const [drafts,setDrafts]=useState<Draft[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState('');
  const [promo,setPromo]=useState<CardPromo|null>(null),[style,setStyle]=useState<PromoStyle>('gold'),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[progress,setProgress]=useState(0),[download,setDownload]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null),assets=useRef<{art:HTMLImageElement;logo:HTMLImageElement}|null>(null),frame=useRef(0),exportAbort=useRef<AbortController|null>(null),loadVersion=useRef(0);
  const refresh=useCallback(async()=>{try{const data=await responseJson(await fetch('/api/admin/card-promos',{cache:'no-store'}));setDrafts(data.drafts);setError('');}catch(error){setError(error instanceof Error?error.message:'Could not load drafts.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void refresh();const versions=loadVersion;return()=>{cancelAnimationFrame(frame.current);exportAbort.current?.abort();versions.current++;};},[refresh]);
  useEffect(()=>{if(!download)return;return()=>URL.revokeObjectURL(download);},[download]);
  useEffect(()=>{if(promo&&ready&&canvas.current&&assets.current)drawCardPromo(canvas.current,promo,assets.current.art,assets.current.logo,2.8,style);},[promo,style,ready]);
  async function open(draft:Draft){
    cancelAnimationFrame(frame.current);setPlaying(false);setReady(false);setPromo(null);setDownload('');setBusy(draft.card_id);setError('');setMessage('');const version=++loadVersion.current;
    try{const data:CardPromo=await responseJson(await fetch(`/api/admin/card-promos?cardId=${encodeURIComponent(draft.card_id)}&revision=${draft.revision}`,{cache:'no-store'}));const [art,logo]=await Promise.all([loadPromoImage(data.artwork),loadPromoImage('/gay-retro-flat.webp')]);if(version!==loadVersion.current)return;assets.current={art,logo};setStyle(data.style);setPromo(data);setReady(true);}
    catch(error){if(version===loadVersion.current)setError(error instanceof Error?error.message:'Could not prepare preview.');}finally{if(version===loadVersion.current)setBusy('');}
  }
  function preview(){if(!promo||!canvas.current||!assets.current)return;cancelAnimationFrame(frame.current);setPlaying(true);const start=performance.now();const tick=(now:number)=>{if(!canvas.current||!assets.current)return;const seconds=(now-start)/1000;drawCardPromo(canvas.current,promo,assets.current.art,assets.current.logo,seconds,style);if(seconds<PROMO_SECONDS)frame.current=requestAnimationFrame(tick);else setPlaying(false);};frame.current=requestAnimationFrame(tick);}
  async function decide(draft:Pick<Draft,'card_id'|'revision'>,decision:'exported'|'dismissed'){
    return responseJson(await fetch('/api/admin/card-promos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cardId:draft.card_id,revision:draft.revision,decision})}));
  }
  async function exportVideo(){
    if(!promo||!canvas.current||!assets.current)return;
    cancelAnimationFrame(frame.current);setPlaying(false);setBusy('export');setProgress(0);setError('');setDownload('');setMessage('Rendering on your device. Keep this tab visible for eight seconds.');
    const controller=new AbortController();exportAbort.current=controller;
    try{
      // Revalidate immediately before and after rendering; stale footage is never offered as a new export.
      await responseJson(await fetch(`/api/admin/card-promos?cardId=${encodeURIComponent(promo.cardId)}&revision=${promo.revision}`,{cache:'no-store'}));
      const blob=await recordCardPromo(canvas.current,promo,assets.current.art,assets.current.logo,style,setProgress,controller.signal);
      if(controller.signal.aborted)return;
      await decide({card_id:promo.cardId,revision:promo.revision},'exported');
      if(controller.signal.aborted)return;
      setDownload(URL.createObjectURL(blob));setMessage('MP4 ready. Download it and copy the caption, then upload to TikTok. Nothing has been posted.');await refresh();
    }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Export failed.');setMessage('');}finally{setBusy('');exportAbort.current=null;}
  }
  async function dismiss(draft:Draft){setBusy(draft.card_id);setError('');try{await decide(draft,'dismissed');if(promo?.cardId===draft.card_id){setPromo(null);setReady(false);setDownload('');}await refresh();}catch(error){setError(error instanceof Error?error.message:'Could not dismiss draft.');}finally{setBusy('');}}
  const pending=drafts.filter(d=>d.state==='pending');
  return <section className={styles.studio} aria-labelledby="card-promos-title"><div className={styles.header}><div><p className={styles.eyebrow}>Listing → animated promo</p><h3 id="card-promos-title">Card promo studio</h3><p>New listings automatically join the draft queue. Preview an eight-second card reveal with your logo, current price and shop address.</p></div><span className={styles.free}>£0 rendering · on your device</span></div>
    <p className={styles.note}>Uses matching catalogue artwork, never your uploaded photos. Export an MP4 and finish the post in TikTok, where you can add music. No Suno workflow or automatic publishing.</p>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status">{message}</p>}
    <div className={styles.workspace}><div><div className={styles.queueHeading}><h4>Promo queue · {pending.length} new</h4><button type="button" disabled={!!busy||playing} onClick={()=>void refresh()}>Refresh queue</button></div>{loading?<p>Loading drafts…</p>:!drafts.length?<p>No listings yet. Add an available card with a price to prepare its promo.</p>:<ul className={styles.queue}>{drafts.map(d=><li key={d.card_id}><strong>{d.Card?.name||'Listing unavailable'}</strong><span>{d.Card?`£${(d.Card.price/100).toFixed(2)} · `:''}{d.state==='pending'?'Ready to prepare':d.state==='exported'?'Exported · not posted':d.state==='dismissed'?'Dismissed':'Unavailable'}</span><div><button type="button" disabled={!!busy||playing||d.state==='unavailable'} onClick={()=>void open(d)}>{busy===d.card_id?'Loading…':d.state==='exported'?'Preview again':'Preview promo'}</button>{d.state==='pending'&&<button type="button" disabled={!!busy||playing} onClick={()=>void dismiss(d)}>Dismiss</button>}</div></li>)}</ul>}<p className={styles.note}>Price, artwork or listing changes refresh the draft. Sold and hidden cards cannot be exported. Export also checks for active checkout reservations. Check availability again before posting an older download.</p></div>
    <div className={styles.editor}><div className={styles.preview}><canvas ref={canvas} width={PROMO_WIDTH} height={PROMO_HEIGHT} hidden={!ready} aria-label={promo?`${promo.name} promo preview`:'Promo preview'}/>{!ready&&<div><span>NOW<br/>AVAILABLE</span><p>Choose a listing to preview its card reveal.</p></div>}</div>{promo&&ready&&<><label htmlFor="promo-style">Colour treatment<select id="promo-style" value={style} disabled={!!busy||playing} onChange={e=>{setStyle(e.target.value as PromoStyle);setDownload('');}}><option value="gold">Shop gold</option><option value="ember">Ember</option><option value="tidal">Tidal</option><option value="neon">Neon</option></select></label><div className={styles.buttons}><button type="button" disabled={!!busy||playing} onClick={preview}>{playing?'Playing…':'Play preview'}</button><button type="button" disabled={!!busy||playing} onClick={()=>void exportVideo()}>{busy==='export'?`Rendering ${Math.round(progress*100)}%`:'Export MP4'}</button></div>{busy==='export'&&<button type="button" onClick={()=>exportAbort.current?.abort()}>Cancel export</button>}{typeof window!=='undefined'&&!promoRecordingType()&&<p>For MP4 export, open this page in current Chrome or Edge.</p>}{download&&<a className={styles.download} href={download} download={`gay-retro-${promo.cardId}-r${promo.revision}-${style}.mp4`}>Download MP4 · 1080 × 1920</a>}<label htmlFor="promo-caption">Caption<textarea id="promo-caption" readOnly value={promo.caption} rows={7}/></label><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(promo.caption);setMessage('Caption copied.');}catch{setMessage('Select the caption above and copy it.');}}}>Copy caption</button><p className={styles.note}>Silent video · 8 seconds · 9:16. Catalogue artwork is labelled; grading and condition come from your listing.</p></>}</div></div>
  </section>;
}
