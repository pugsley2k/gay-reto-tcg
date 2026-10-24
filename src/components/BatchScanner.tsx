'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { prepareCardPhoto } from '@/lib/card-photo';
import GroupIdentityScanner from './GroupIdentityScanner';
import type {GroupCardIdentity} from '@/lib/group-card-identity';
import {listingPhotoIssue} from '@/lib/listing-photo-policy';
import CardCondition from './CardCondition';
import DuplicateCheck from './DuplicateCheck';
import ScannerDefaults,{readScannerPreset} from './ScannerDefaults';
import ConditionSuggestion from './ConditionSuggestion';
import { CARD_EDITIONS, isCardEdition } from '@/lib/card-edition';
import { isCardCondition } from '@/lib/card-condition';
import styles from './BatchScanner.module.css';
import PriceComparisons from './PriceComparisons';
import type {PriceComparison} from '@/lib/graded-pricing';
import ScanReview from './ScanReview';
import {printedCardNumber,type ScanNotes} from '@/lib/scan-notes';
import GradingFields from './GradingFields';
import {completeGrading,type Grading} from '@/lib/card-grading';

type Fields = { grading:Grading|null; name: string; number: string; set: string; rarity: string; language: string; holo_type: string; price: string; condition: string; edition: string };
type Metadata = { comparisons?:PriceComparison[]; illustrator?:string|null; edition?: string | null; image_url?: string | null; name?: string; matched?: boolean; set?: string; rarity?: string; holo_type?: string; notice?: string; candidates?: {id:string;name:string;set:string;number:string}[]; pricing?: {gbp:string;source:string;updated:string;url?:string} };
type Item = { actualPhoto?:boolean; groupPosition?:string; notes?:ScanNotes|null; fingerprint?:string; back?:File|null; backUpload?:{url:string;public_id:string}; id: string; file: File; preview: string; status: 'queued'|'scanning'|'review'|'error'|'publishing'|'published'; fields: Fields; included: boolean; reviewed: boolean; savedAsDraft?: boolean; usePhoto?: boolean; error: string; original: string; total: string; metadata?: Metadata; uploaded?: {url:string;public_id:string} };
const empty: Fields = {grading:null,name:'',number:'',set:'',rarity:'',language:'English',holo_type:'',price:'',condition:'',edition:''};
async function responseData(response: Response) {
 const data = await response.json().catch(()=>({}));
 if (!response.ok) throw new Error(data.error || data.message || 'Request failed. Try again.');
 return data;
}
function photoIssue(item:Item){return listingPhotoIssue(Math.round(Number(item.fields.price)*100),!!item.fields.grading,item.actualPhoto!==false,!!item.metadata?.matched&&!!item.metadata?.image_url&&!item.usePhoto);}
function valid(item: Item) { const p=Number(item.fields.price); return !photoIssue(item) && ['English','Japanese','Korean'].includes(item.fields.language) && isCardEdition(item.fields.edition) && (item.fields.grading ? completeGrading(item.fields.grading)&&item.fields.grading.confirmed : isCardCondition(item.fields.condition)) && !!item.preview && !!item.fields.name.trim() && !!item.fields.number.trim() && !!item.fields.set.trim() && !!item.fields.rarity.trim() && !!item.fields.holo_type && !!item.fields.price.trim() && Number.isFinite(p) && p>=.01 && p<=100000; }
function missingDetails(item:Item){const fields=item.fields;const missing=['name','number','set','rarity','holo_type'].filter(key=>!fields[key as 'name'|'number'|'set'|'rarity'|'holo_type']?.trim()).map(key=>key==='holo_type'?'finish':key);if(!isCardEdition(fields.edition))missing.push('edition');if(fields.grading?(!completeGrading(fields.grading)||!fields.grading.confirmed):!isCardCondition(fields.condition))missing.push(fields.grading?'confirmed slab label':'condition');const price=Number(fields.price);if(!fields.price||!Number.isFinite(price)||price<.01||price>100000)missing.push('valid price (£0.01–£100,000)');if(!['English','Japanese','Korean'].includes(fields.language))missing.push('language');if(photoIssue(item))missing.push(photoIssue(item));return missing.join(', ');}
function mergeMetadata(fields: Fields, metadata: Metadata): Fields { return metadata.matched ? {...fields,edition:metadata.edition === undefined ? fields.edition : metadata.edition || '',name:metadata.name || fields.name,set:metadata.set || '',rarity:metadata.rarity || '',holo_type:metadata.holo_type || fields.holo_type,price:metadata.pricing?.gbp || fields.price} : fields; }

export default function BatchScanner() {
 const [items,setItems]=useState<Item[]>([]);
 const current=useRef<Item[]>([]);
 const [scanning,setScanning]=useState(false);
 const [groupOpen,setGroupOpen]=useState(false);
 const [groupBusy,setGroupBusy]=useState(false);
 const [addingPhotos,setAddingPhotos]=useState(false);
 const [publishing,setPublishing]=useState(false);
 const [notice,setNotice]=useState('');
 const [queueFilter,setQueueFilter]=useState('all');
 const [lookupId,setLookupId]=useState('');
 const [conditionBusy,setConditionBusy]=useState(false);
 const locked=useRef(false);
 const photos=useRef<HTMLInputElement>(null);
 const urls=useRef(new Set<string>());
 useEffect(()=>()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
 useEffect(()=>{
  if(!items.some(item=>item.status!=='published'))return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return ()=>window.removeEventListener('beforeunload',warn);
 },[items]);
 function mutate(fn:(prev:Item[])=>Item[]) { const next=fn(current.current);current.current=next;setItems(next); }
 function update(id:string,patch:Partial<Item>) {mutate(prev=>prev.map(item=>item.id===id?{...item,...patch}:item));}
 async function scanOne(id:string) {
  const item=current.current.find(i=>i.id===id);if(!item)return;
  update(id,{status:'scanning',error:'',reviewed:false});
  try {
   const file=await prepareCardPhoto(item.file);
   const preview=URL.createObjectURL(file);urls.current.add(preview);
   if(item.preview){URL.revokeObjectURL(item.preview);urls.current.delete(item.preview);}
   update(id,{file,preview,uploaded:undefined,back:null,backUpload:undefined,reviewed:false});
   const body=new FormData();body.append('image',file);
   const result=await responseData(await fetch('/api/scan-card',{method:'POST',body}));
   const defaults=readScannerPreset();
   const fields={...empty,name:result.english_name||'',set:result.scan_notes?.label_set||'',number:printedCardNumber(result.card_number,result.card_total),language:result.language||defaults.language,holo_type:defaults.finish,edition:result.edition||'',grading:result.grading||null};
   update(id,{status:'review',notes:result.scan_notes||null,fields:mergeMetadata(fields,result.enrichment||{}),metadata:result.enrichment,usePhoto:false,original:result.original_name||'',total:result.card_total||''});
  }catch(error){update(id,{status:'error',error:error instanceof Error?error.message:'Scan failed. Retry or enter details manually.'});}
 }
 async function resolveGroup(id:string){
  const item=current.current.find(i=>i.id===id);if(!item)return;
  if(!item.fields.name||!item.fields.number||!item.fields.language){update(id,{status:'review',error:'Some printed details were unreadable. Check the reference photo and enter them before catalogue lookup.'});return;}
  update(id,{status:'scanning'});
  try{const metadata=await responseData(await fetch('/api/card-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:item.fields.name,original_name:item.original,number:item.fields.number.split('/')[0],total:item.total,language:item.fields.language,finish:item.fields.holo_type,edition:item.fields.edition})}));update(id,{metadata,fields:mergeMetadata(item.fields,metadata),status:'review',usePhoto:false});}catch{update(id,{status:'review',error:'Catalogue lookup failed. Confirm details and use Refresh set & price to retry.'});}
 }
 function addGroup(file:File,cards:GroupCardIdentity[]){
  if(locked.current||cards.length+current.current.length>20)return;
  const preview=URL.createObjectURL(file);urls.current.add(preview);
  const added:Item[]=cards.map(card=>({id:crypto.randomUUID(),file,preview,actualPhoto:false,groupPosition:card.position,status:'queued',fields:{...empty,name:card.name,number:printedCardNumber(card.card_number,card.card_total),language:card.language,edition:card.edition,holo_type:card.finish,grading:card.slab?{company:'',grade:'',cert_number:'',confirmed:false}:null},included:true,reviewed:false,error:card.warning,original:card.original_name,total:card.card_total}));
  mutate(prev=>[...prev,...added]);void runQueue(added.map(i=>i.id));
 }
 async function attachPhoto(id:string,photo?:File){
  if(!photo||busy)return;setAddingPhotos(true);
  try{const file=await prepareCardPhoto(photo),preview=URL.createObjectURL(file);urls.current.add(preview);update(id,{file,preview,actualPhoto:true,uploaded:undefined,back:null,backUpload:undefined,reviewed:false,error:''});}catch(error){update(id,{error:error instanceof Error?error.message:'Could not prepare this photo.'});}finally{setAddingPhotos(false);}
 }
 async function runQueue(ids:string[]) {
  if(locked.current)return;locked.current=true;setScanning(true);setNotice('');
  let index=0;
  async function worker(){while(index<ids.length){const id=ids[index++];if(current.current.find(i=>i.id===id)?.actualPhoto===false)await resolveGroup(id);else await scanOne(id);}}
  try{await Promise.all([worker(),worker()]);}finally{locked.current=false;setScanning(false);}
 }
 async function addFiles(files:File[],fingerprints?:string[]):Promise<boolean> {
  if(locked.current||lookupId||conditionBusy)return false;
  locked.current=true;setAddingPhotos(true);let queued=false;
  try{
   if(!files.length)return false;
   if(current.current.length+files.length>20){setNotice('Use up to 20 cards per batch. Finish this batch before adding more.');return false;}
   if(files.reduce((n,f)=>n+f.size,0)>100*1024*1024){setNotice('Choose a smaller group: selected photos must total less than 100 MB.');return false;}
   const known=new Set(current.current.map(item=>item.fingerprint));const unique:{file:File;fingerprint:string}[]=[];
   for(const [index,file] of files.entries()){const fingerprint=fingerprints?.[index]||Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(value=>value.toString(16).padStart(2,'0')).join('');if(!known.has(fingerprint)){known.add(fingerprint);unique.push({file,fingerprint});}}
   const added=unique.map(({file,fingerprint})=>({id:crypto.randomUUID(),fingerprint,file,preview:'',status:'queued' as const,fields:{...empty},included:true,reviewed:false,error:'',original:'',total:''}));
   if(!added.length){setNotice('These exact photos or group crops are already in this batch.');return false;}
   mutate(prev=>[...prev,...added]);locked.current=false;queued=true;void runQueue(added.map(i=>i.id));return true;
  }catch{setNotice('Could not prepare these photos. Your existing batch is unchanged.');return false;}
  finally{if(!queued)locked.current=false;setAddingPhotos(false);}
 }

 function edit(id:string,key:Exclude<keyof Fields,'grading'>,value:string) {
  const item=current.current.find(i=>i.id===id);if(!item)return;
  const identity=['name','number','language'].includes(key);
  const fields={...item.fields,grading:item.fields.grading?{...item.fields.grading,confirmed:false}:null,...(identity?{set:'',rarity:'',holo_type:'',price:''}:{}),...(['set','holo_type','edition'].includes(key)?{price:''}:{}),[key]:value};
  update(id,{fields,reviewed:false,...(identity?{notes:null,original:'',total:'',metadata:undefined}:{}),...(['set','holo_type','edition'].includes(key)?{metadata:undefined}:{}),error:''});
 }
 async function lookup(id:string,catalog_id?:string) {
  const item=current.current.find(i=>i.id===id);if(!item)return;
  setLookupId(id);update(id,{reviewed:false,error:''});
  try {
   const metadata=await responseData(await fetch('/api/card-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item.fields,number:item.fields.number.split('/')[0],original_name:item.original||item.fields.name,total:item.fields.number.split('/')[1]||item.total,finish:item.fields.holo_type,catalog_id})}));
   const refreshed=mergeMetadata(item.fields,metadata);
   if(refreshed.grading)refreshed.grading={...refreshed.grading,confirmed:false};
   update(id,{metadata,usePhoto:false,fields:refreshed,status:'review'});
  }catch(error){update(id,{error:error instanceof Error?error.message:'Lookup failed.'});}
  finally{setLookupId('');}
 }
 const pending=items.filter(i=>i.status!=='published');
 const included=pending.filter(i=>i.included);
 const ready=included.length>0&&included.every(i=>i.reviewed&&valid(i)&&!['queued','scanning'].includes(i.status));
 const busy=scanning||publishing||!!lookupId||conditionBusy||groupBusy||addingPhotos;
 async function publish(available=true) {
  if(locked.current||lookupId||conditionBusy||groupBusy||addingPhotos||!ready)return;
  const selected=current.current.filter(i=>i.included&&i.status!=='published');
  if(!selected.every(i=>i.reviewed&&valid(i)))return;
  locked.current=true;setPublishing(true);setNotice('');
  let count=0;
  try {
   for(const initial of selected){
    update(initial.id,{status:'publishing',error:''});
    try{
     let upload=initial.uploaded;
     if(initial.actualPhoto!==false&&!upload){const body=new FormData();body.append('file',initial.file);upload=await responseData(await fetch('/api/upload',{method:'POST',body}));update(initial.id,{uploaded:upload});}
     if(initial.actualPhoto!==false&&!upload?.url)throw new Error('Photo upload did not complete. Retry this card.');
     let backUpload=initial.backUpload;if(initial.back&&!backUpload){const body=new FormData();body.append('file',initial.back);backUpload=await responseData(await fetch('/api/upload',{method:'POST',body}));update(initial.id,{backUpload});}
     await responseData(await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...initial.fields,client_id:initial.id,price:Math.round(Number(initial.fields.price)*100),image_url:!initial.usePhoto&&initial.metadata?.matched&&initial.metadata.image_url?initial.metadata.image_url:upload?.url,front_image_url:initial.actualPhoto===false?null:upload?.url,back_image_url:backUpload?.url||null,scan_url:initial.actualPhoto===false?null:upload?.public_id,available})}));
     update(initial.id,{status:'published',savedAsDraft:!available});count++;
    }catch(error){update(initial.id,{status:'review',error:error instanceof Error?error.message:'Could not publish. Retry this card.'});}
   }
   setNotice(`${count} of ${selected.length} cards ${available ? 'published' : 'saved as drafts'} in this attempt. ${selected.length-count ? 'Failed cards remain here for retry; published cards will not be sent again.' : 'Your reviewed cards were saved successfully.'}`);
  }finally{locked.current=false;setPublishing(false);}
 }
 function clear() {if(busy)return;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();mutate(()=>[]);setNotice('');}
 return <main className={styles.page}>
  <header className={styles.header}><Link href="/admin">← Seller studio</Link><span>GAY RETRO / BATCH SCANNER</span></header>
  <p className={styles.eyebrow}>Scan, review and publish</p><h1>Scan multiple cards.<br /><em>Review before publishing.</em></h1>
  <p className={styles.intro}>Add up to 20 cards using individual photos or a group photo. Group photos identify cards directly; review each catalogue match, condition and price before publishing.</p>
  <p className={styles.note}>Keep this page open until you finish. This queue stays in this tab and is lost if you reload or close it. Photos go to OpenAI for recognition; group photos are recognition references only. Ungraded cards under £20 can use confirmed catalogue artwork without an actual-card photo. Individual photos are required for higher-priced and graded cards.</p>
  <ScannerDefaults/>
  <input ref={photos} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value='';}} />
  <div className={styles.toolbar}><button disabled={busy||items.length>=20} onClick={()=>photos.current?.click()}>{items.length?'Add more photos':'Choose card photos'}</button><button type="button" className={styles.secondary} disabled={busy} aria-expanded={groupOpen} aria-controls="group-photo-scanner" onClick={()=>setGroupOpen(value=>!value)}>{groupOpen?'Hide group photo tool':'Cards in one photo'}</button>{items.length>0&&<button className={styles.secondary} disabled={busy} onClick={clear}>Clear batch</button>}</div>
  <div id="group-photo-scanner" hidden={!groupOpen}><GroupIdentityScanner disabled={scanning||publishing||!!lookupId||conditionBusy||addingPhotos} remaining={20-items.length} onCards={addGroup} onBusy={setGroupBusy}/></div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {items.length>0&&<div className={styles.progress} role="status">{scanning?`${items.filter(i=>!['queued','scanning'].includes(i.status)).length} of ${items.length} scanned — two cards at a time`: `${items.filter(i=>i.reviewed&&i.status!=='published').length} reviewed · ${items.filter(i=>i.status==='published'&&!i.savedAsDraft).length} published · ${items.filter(i=>i.savedAsDraft).length} drafts · ${pending.filter(i=>!i.included).length} excluded`}</div>}
  {items.length>0&&<label>Show cards<select value={queueFilter} onChange={event=>setQueueFilter(event.target.value)}><option value="all">All cards</option><option value="review">Needs review</option><option value="ready">Reviewed</option><option value="error">Errors</option></select></label>}
  <div className={styles.queue}>{items.filter(item=>queueFilter==='all'||(queueFilter==='ready'?item.reviewed:queueFilter==='error'?!!item.error:!item.reviewed&&item.status!=='published')).map((item,index)=><article key={item.id} className={styles.item}>
   <div className={styles.itemTop}>{item.preview?<img src={item.actualPhoto===false&&item.metadata?.matched&&item.metadata.image_url?item.metadata.image_url:item.preview} alt={item.actualPhoto===false?`Catalogue artwork or recognition reference ${index+1}`:`Card photo ${index+1}`} />:<span className={styles.placeholder}>{index+1}</span>}<div><span className={styles.eyebrow}>CARD {index+1} / {item.status==='published'?(item.savedAsDraft?'DRAFT SAVED':'PUBLISHED'):item.status==='scanning'?'SCANNING':item.status==='queued'?'QUEUED':item.reviewed?'REVIEWED':'NEEDS REVIEW'}</span><h2>{item.fields.name||item.groupPosition||item.file.name}</h2><p>{item.fields.set||'Set not confirmed'}{item.fields.price?` · £${Number(item.fields.price).toFixed(2)}`:''}</p></div></div>
   {item.actualPhoto===false&&<p className={styles.note}>{item.groupPosition||'Group photo'} · Recognition reference only; not a listing photo.</p>}
   {item.error&&<p className={styles.error} role="alert">{item.error}</p>}
   {!['queued','scanning','published','publishing'].includes(item.status)&&<><label className={styles.check}><input type="checkbox" checked={item.included} disabled={busy} onChange={e=>update(item.id,{included:e.target.checked})}/>Include in this batch</label>
   <details><summary>Review card {index+1}{item.reviewed?' — checked':''}</summary><div className={styles.editor}><fieldset disabled={busy}><legend className={styles.srOnly}>Details for card {index+1}</legend>
    <label>{item.actualPhoto===false?'Add individual card photo':'Replace individual card photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void attachPhoto(item.id,e.target.files?.[0]);e.target.value='';}}/></label>
    {item.actualPhoto===false&&<div><p className={styles.note}>Group photo reference - {item.groupPosition||'check the correct card'}. Not published.</p><img src={item.preview} alt="Group photo used for identification only" style={{maxWidth:'100%',maxHeight:400,objectFit:'contain'}}/></div>}
    {item.actualPhoto===false&&<p className={styles.note}>{photoIssue(item)||'Catalogue artwork only: this group photo will not be uploaded or published.'}</p>}
    {item.metadata?.matched&&item.metadata.image_url?<div><p className={styles.note}>Catalogue artwork — check that it matches your card.</p><img src={item.metadata.image_url} alt={`Catalogue artwork for card ${index+1}`} width={120} height={165} style={{objectFit:'contain'}} onError={()=>update(item.id,{metadata:{...item.metadata,image_url:null},reviewed:false})}/><label className={styles.check}><input type="checkbox" checked={!!item.usePhoto} disabled={item.actualPhoto===false} onChange={e=>update(item.id,{usePhoto:e.target.checked,reviewed:false})}/>Use my photo instead</label></div>:<p className={styles.note}>No catalogue image available. Add an individual photo or confirm a catalogue match.</p>}
    {item.metadata?.notice&&<p className={styles.note}>{item.metadata.notice}</p>}
    {item.metadata?.candidates?.map(c=><button type="button" className={styles.secondary} key={c.id} onClick={()=>void lookup(item.id,c.id)}>{c.set} · {c.name} #{c.number}</button>)}
    <ScanReview notes={item.notes||null} illustrator={item.metadata?.illustrator}/>
    <GradingFields photo={item.actualPhoto===false?undefined:item.file} card={{name:item.fields.name,number:item.fields.number,set:item.fields.set}} value={item.fields.grading} onChange={grading=>{const old=item.fields.grading;const changed=grading?.company!==old?.company||grading?.grade!==old?.grade||!!grading!==!!old;update(item.id,{fields:{...item.fields,grading,...(changed?{price:''}:{})},reviewed:false,...(changed?{metadata:undefined}:{} )});}}/>
    {(['name','number','set','rarity'] as const).map(key=><label key={key}>{({name:'Card name',number:'Card number',set:'Set',rarity:'Rarity'})[key]}<input maxLength={key==='name'?200:key==='number'?40:key==='set'?160:100} value={item.fields[key]} onChange={e=>edit(item.id,key,e.target.value)}/></label>)}
    <div className={styles.fields}><label>Language<select value={item.fields.language} onChange={e=>edit(item.id,'language',e.target.value)}><option value="">Confirm language</option>{['English','Japanese','Korean'].map(l=><option key={l}>{l}</option>)}</select></label><label>Finish<select value={item.fields.holo_type} onChange={e=>edit(item.id,'holo_type',e.target.value)}><option value="">Confirm finish</option>{[...new Set([item.fields.holo_type,'Normal','Reverse Holo','Holo Rare','Double Rare','Ultra Rare','Full Art','Alt Art','Illustration Rare','Special Illustration Rare','Hyper Rare','Shiny Rare','Shiny Ultra Rare','Radiant Rare','Pokeball Holo','Master Ball Holo','Cosmos Holo','Promo'])].filter(Boolean).map(v=><option key={v}>{v}</option>)}</select></label></div>
    <label>Price (£)<input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" value={item.fields.price} onChange={e=>edit(item.id,'price',e.target.value)}/></label>
    {item.metadata?.pricing&&<p className={styles.note}>Suggested £{item.metadata.pricing.gbp} · {item.metadata.pricing.source} · {item.metadata.pricing.updated.slice(0,10)}. {item.fields.grading?'Check this exact graded match.':'Adjust for condition.'}{item.metadata.pricing.url&&<> <a href={item.metadata.pricing.url} target="_blank" rel="noopener noreferrer">View price source ↗</a></>}</p>}
    <PriceComparisons items={item.metadata?.comparisons} onUse={price=>edit(item.id,'price',price)}/>
    <div className={styles.toolbar}><button type="button" className={styles.secondary} onClick={()=>void lookup(item.id)}>Refresh set & price</button><button type="button" className={styles.secondary} onClick={()=>void runQueue([item.id])} disabled={item.actualPhoto===false}>Rescan photo</button></div>
    <label>Edition<select value={item.fields.edition} onChange={e=>edit(item.id,'edition',e.target.value)}><option value="">Check edition</option>{CARD_EDITIONS.map(v=><option key={v}>{v}</option>)}</select></label>
    <DuplicateCheck name={item.fields.name} number={item.fields.number} set={item.fields.set} language={item.fields.language}/>
    {!item.fields.grading&&item.actualPhoto!==false&&<ConditionSuggestion onBackPhoto={back=>update(item.id,{back,backUpload:undefined,reviewed:false})} key={item.preview} front={item.file} disabled={busy} onBusy={setConditionBusy} onInvalidate={()=>edit(item.id,'condition','')} onConfirm={value=>edit(item.id,'condition',value)}/>}
    {!item.fields.grading&&<CardCondition value={item.fields.condition} onChange={value=>edit(item.id,'condition',value)} disabled={busy}/>}
    <label className={styles.check}><input type="checkbox" checked={item.reviewed} disabled={!valid(item)} onChange={e=>update(item.id,{reviewed:e.target.checked,status:'review'})}/>I’ve checked the catalogue artwork, card, finish, condition and price</label>
    {!valid(item)&&<p className={styles.note}>Still needed: {missingDetails(item)}.</p>}
   </fieldset></div></details></>}
   {item.status==='publishing'&&<p role="status">Saving this card…</p>}
  </article>)}</div>
  {items.length>0&&<section className={styles.publish}><h2>Review first. Publish together.</h2><p>{included.length} included cards. Every included card must be checked. Exclude anything you want to leave out.</p><button disabled={busy||!ready} onClick={()=>void publish()}>{publishing?'Saving reviewed cards…':`Publish ${included.length} reviewed card${included.length===1?'':'s'}`}</button><button className={styles.secondary} disabled={busy||!ready} onClick={()=>void publish(false)}>Save reviewed as drafts</button><Link href="/shop">View the shop ↗</Link></section>}
 </main>;
}
