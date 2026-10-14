'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { prepareCardPhoto } from '@/lib/card-photo';
import CardCondition from './CardCondition';
import ConditionSuggestion from './ConditionSuggestion';
import { isCardCondition } from '@/lib/card-condition';
import styles from './BatchScanner.module.css';

type Fields = { name: string; number: string; set: string; rarity: string; language: string; holo_type: string; price: string; condition: string };
type Metadata = { image_url?: string | null; name?: string; matched?: boolean; set?: string; rarity?: string; holo_type?: string; notice?: string; candidates?: {id:string;name:string;set:string;number:string}[]; pricing?: {gbp:string;source:string;updated:string} };
type Item = { id: string; file: File; preview: string; status: 'queued'|'scanning'|'review'|'error'|'publishing'|'published'; fields: Fields; included: boolean; reviewed: boolean; savedAsDraft?: boolean; usePhoto?: boolean; error: string; original: string; total: string; metadata?: Metadata; uploaded?: {url:string;public_id:string} };
const empty: Fields = {name:'',number:'',set:'',rarity:'',language:'English',holo_type:'',price:'',condition:''};
async function responseData(response: Response) {
 const data = await response.json().catch(()=>({}));
 if (!response.ok) throw new Error(data.error || data.message || 'Request failed. Try again.');
 return data;
}
function valid(item: Item) { const p=Number(item.fields.price); return isCardCondition(item.fields.condition) && !!item.preview && !!item.fields.name.trim() && !!item.fields.number.trim() && !!item.fields.set.trim() && !!item.fields.rarity.trim() && !!item.fields.holo_type && !!item.fields.price.trim() && Number.isFinite(p) && p>=.01 && p<=100000; }
function mergeMetadata(fields: Fields, metadata: Metadata): Fields { return metadata.matched ? {...fields,name:metadata.name || fields.name,set:metadata.set || '',rarity:metadata.rarity || '',holo_type:metadata.holo_type || '',price:metadata.pricing?.gbp || ''} : fields; }

export default function BatchScanner() {
 const [items,setItems]=useState<Item[]>([]);
 const current=useRef<Item[]>([]);
 const [scanning,setScanning]=useState(false);
 const [publishing,setPublishing]=useState(false);
 const [notice,setNotice]=useState('');
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
   update(id,{file,preview,uploaded:undefined});
   const body=new FormData();body.append('image',file);
   const result=await responseData(await fetch('/api/scan-card',{method:'POST',body}));
   const fields={...empty,name:result.english_name||'',number:result.card_number||'',language:result.language||'English'};
   update(id,{status:'review',fields:mergeMetadata(fields,result.enrichment||{}),metadata:result.enrichment,usePhoto:false,original:result.original_name||'',total:result.card_total||''});
  }catch(error){update(id,{status:'error',error:error instanceof Error?error.message:'Scan failed. Retry or enter details manually.'});}
 }
 async function runQueue(ids:string[]) {
  if(locked.current)return;locked.current=true;setScanning(true);setNotice('');
  let index=0;
  async function worker(){while(index<ids.length){const id=ids[index++];await scanOne(id);}}
  try{await Promise.all([worker(),worker()]);}finally{locked.current=false;setScanning(false);}
 }
 function addFiles(files:File[]) {
  if(locked.current||lookupId)return;
  if(current.current.length+files.length>20){setNotice('Use up to 20 photos per batch. Finish this batch before adding more.');return;}
  if(files.reduce((n,f)=>n+f.size,0)>100*1024*1024){setNotice('Choose a smaller group: selected photos must total less than 100 MB.');return;}
  const added=files.map(file=>({id:crypto.randomUUID(),file,preview:'',status:'queued' as const,fields:{...empty},included:true,reviewed:false,error:'',original:'',total:''}));
  mutate(prev=>[...prev,...added]);void runQueue(added.map(i=>i.id));
 }
 function edit(id:string,key:keyof Fields,value:string) {
  const item=current.current.find(i=>i.id===id);if(!item)return;
  const identity=['name','number','language'].includes(key);
  const fields={...item.fields,...(identity?{set:'',rarity:'',holo_type:'',price:''}:{}),...(['set','holo_type'].includes(key)?{price:''}:{}),[key]:value};
  update(id,{fields,reviewed:false,...(identity?{original:'',total:'',metadata:undefined}:{}),...(['set','holo_type'].includes(key)?{metadata:undefined}:{}),error:''});
 }
 async function lookup(id:string,catalog_id?:string) {
  const item=current.current.find(i=>i.id===id);if(!item)return;
  setLookupId(id);update(id,{reviewed:false,error:''});
  try {
   const metadata=await responseData(await fetch('/api/card-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item.fields,original_name:item.original||item.fields.name,total:item.total,finish:item.fields.holo_type,catalog_id})}));
   update(id,{metadata,usePhoto:false,fields:mergeMetadata(item.fields,metadata),status:'review'});
  }catch(error){update(id,{error:error instanceof Error?error.message:'Lookup failed.'});}
  finally{setLookupId('');}
 }
 const pending=items.filter(i=>i.status!=='published');
 const included=pending.filter(i=>i.included);
 const ready=included.length>0&&included.every(i=>i.reviewed&&valid(i)&&!['queued','scanning'].includes(i.status));
 const busy=scanning||publishing||!!lookupId||conditionBusy;
 async function publish(available=true) {
  if(locked.current||lookupId||conditionBusy||!ready)return;
  const selected=current.current.filter(i=>i.included&&i.status!=='published');
  if(!selected.every(i=>i.reviewed&&valid(i)))return;
  locked.current=true;setPublishing(true);setNotice('');
  let count=0;
  try {
   for(const initial of selected){
    update(initial.id,{status:'publishing',error:''});
    try{
     let upload=initial.uploaded;
     if(!upload){const body=new FormData();body.append('file',initial.file);upload=await responseData(await fetch('/api/upload',{method:'POST',body}));update(initial.id,{uploaded:upload});}
     if(!upload?.url)throw new Error('Photo upload did not complete. Retry this card.');
     await responseData(await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...initial.fields,client_id:initial.id,price:Math.round(Number(initial.fields.price)*100),image_url:!initial.usePhoto&&initial.metadata?.matched&&initial.metadata.image_url?initial.metadata.image_url:upload.url,scan_url:upload.public_id,available})}));
     update(initial.id,{status:'published',savedAsDraft:!available});count++;
    }catch(error){update(initial.id,{status:'review',error:error instanceof Error?error.message:'Could not publish. Retry this card.'});}
   }
   setNotice(`${count} of ${selected.length} cards ${available ? 'published' : 'saved as drafts'} in this attempt. ${selected.length-count ? 'Failed cards remain here for retry; published cards will not be sent again.' : 'Your reviewed cards were saved successfully.'}`);
  }finally{locked.current=false;setPublishing(false);}
 }
 function clear() {if(busy)return;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();mutate(()=>[]);setNotice('');}
 return <main className={styles.page}>
  <header className={styles.header}><Link href="/admin">← Seller studio</Link><span>GAY RETRO / BATCH SCANNER</span></header>
  <p className={styles.eyebrow}>A quicker way to fill the shop</p><h1>A whole binder.<br /><em>One batch.</em></h1>
  <p className={styles.intro}>Choose up to 20 photos, one card in each. We’ll scan the details, sets, rarities and prices. Review every included card before publishing.</p>
  <p className={styles.note}>Keep this page open until you finish. This queue stays in this tab and is lost if you reload or close it. Photos go to OpenAI for recognition; your photos are kept as references when you save. Matched catalogue artwork is used for listings, with your photo as the fallback.</p>
  <input ref={photos} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value='';}} />
  <div className={styles.toolbar}><button disabled={busy||items.length>=20} onClick={()=>photos.current?.click()}>{items.length?'Add more photos':'Choose card photos'}</button>{items.length>0&&<button className={styles.secondary} disabled={busy} onClick={clear}>Clear batch</button>}</div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {items.length>0&&<div className={styles.progress} role="status">{scanning?`${items.filter(i=>!['queued','scanning'].includes(i.status)).length} of ${items.length} scanned — two cards at a time`: `${items.filter(i=>i.reviewed&&i.status!=='published').length} reviewed · ${items.filter(i=>i.status==='published'&&!i.savedAsDraft).length} published · ${items.filter(i=>i.savedAsDraft).length} drafts · ${pending.filter(i=>!i.included).length} excluded`}</div>}
  <div className={styles.queue}>{items.map((item,index)=><article key={item.id} className={styles.item}>
   <div className={styles.itemTop}>{item.preview?<img src={item.preview} alt={`Card photo ${index+1}`} />:<span className={styles.placeholder}>{index+1}</span>}<div><span className={styles.eyebrow}>CARD {index+1} / {item.status==='published'?(item.savedAsDraft?'DRAFT SAVED':'PUBLISHED'):item.status==='scanning'?'SCANNING':item.status==='queued'?'QUEUED':item.reviewed?'REVIEWED':'NEEDS REVIEW'}</span><h2>{item.fields.name||item.file.name}</h2><p>{item.fields.set||'Set not confirmed'}{item.fields.price?` · £${Number(item.fields.price).toFixed(2)}`:''}</p></div></div>
   {item.error&&<p className={styles.error} role="alert">{item.error}</p>}
   {!['queued','scanning','published','publishing'].includes(item.status)&&<><label className={styles.check}><input type="checkbox" checked={item.included} disabled={busy} onChange={e=>update(item.id,{included:e.target.checked})}/>Include in this batch</label>
   <details><summary>Review card {index+1}{item.reviewed?' — checked':''}</summary><div className={styles.editor}><fieldset disabled={busy}><legend className={styles.srOnly}>Details for card {index+1}</legend>
    {item.metadata?.matched&&item.metadata.image_url?<div><p className={styles.note}>Catalogue artwork — check that it matches your card.</p><img src={item.metadata.image_url} alt={`Catalogue artwork for card ${index+1}`} width={120} height={165} style={{objectFit:'contain'}} onError={()=>update(item.id,{metadata:{...item.metadata,image_url:null},reviewed:false})}/><label className={styles.check}><input type="checkbox" checked={!!item.usePhoto} onChange={e=>update(item.id,{usePhoto:e.target.checked,reviewed:false})}/>Use my photo instead</label></div>:<p className={styles.note}>No catalogue image available. Your photo will be used.</p>}
    {item.metadata?.notice&&<p className={styles.note}>{item.metadata.notice}</p>}
    {item.metadata?.candidates?.map(c=><button type="button" className={styles.secondary} key={c.id} onClick={()=>void lookup(item.id,c.id)}>{c.set} · {c.name} #{c.number}</button>)}
    {(['name','number','set','rarity'] as const).map(key=><label key={key}>{({name:'Card name',number:'Card number',set:'Set',rarity:'Rarity'})[key]}<input maxLength={key==='name'?200:key==='number'?40:key==='set'?160:100} value={item.fields[key]} onChange={e=>edit(item.id,key,e.target.value)}/></label>)}
    <div className={styles.fields}><label>Language<select value={item.fields.language} onChange={e=>edit(item.id,'language',e.target.value)}>{['English','Japanese','Korean'].map(l=><option key={l}>{l}</option>)}</select></label><label>Finish<select value={item.fields.holo_type} onChange={e=>edit(item.id,'holo_type',e.target.value)}><option value="">Confirm finish</option>{[...new Set([item.fields.holo_type,'Normal','Reverse Holo','Holo Rare','Double Rare','Ultra Rare','Full Art','Alt Art','Illustration Rare','Special Illustration Rare','Hyper Rare','Shiny Rare','Shiny Ultra Rare','Radiant Rare','Pokeball Holo','Master Ball Holo','Cosmos Holo','Promo'])].filter(Boolean).map(v=><option key={v}>{v}</option>)}</select></label></div>
    <label>Price (£)<input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" value={item.fields.price} onChange={e=>edit(item.id,'price',e.target.value)}/></label>
    {item.metadata?.pricing&&<p className={styles.note}>Suggested £{item.metadata.pricing.gbp} · {item.metadata.pricing.source} · {item.metadata.pricing.updated.slice(0,10)}. Adjust for condition.</p>}
    <div className={styles.toolbar}><button type="button" className={styles.secondary} onClick={()=>void lookup(item.id)}>Refresh set & price</button><button type="button" className={styles.secondary} onClick={()=>void runQueue([item.id])}>Rescan photo</button></div>
    <ConditionSuggestion key={item.preview} front={item.file} disabled={busy} onBusy={setConditionBusy} onInvalidate={()=>edit(item.id,'condition','')} onConfirm={value=>edit(item.id,'condition',value)}/>
    <CardCondition value={item.fields.condition} onChange={value=>edit(item.id,'condition',value)} disabled={busy}/>
    <label className={styles.check}><input type="checkbox" checked={item.reviewed} disabled={!valid(item)} onChange={e=>update(item.id,{reviewed:e.target.checked,status:'review'})}/>I’ve checked the card, finish, condition and price</label>
    {!valid(item)&&<p className={styles.note}>Complete the name, number, set, rarity, finish, condition and a price of at least £0.01 before marking reviewed.</p>}
   </fieldset></div></details></>}
   {item.status==='publishing'&&<p role="status">Saving this card…</p>}
  </article>)}</div>
  {items.length>0&&<section className={styles.publish}><h2>Review first. Publish together.</h2><p>{included.length} included cards. Every included card must be checked. Exclude anything you want to leave out.</p><button disabled={busy||!ready} onClick={()=>void publish()}>{publishing?'Saving reviewed cards…':`Publish ${included.length} reviewed card${included.length===1?'':'s'}`}</button><button className={styles.secondary} disabled={busy||!ready} onClick={()=>void publish(false)}>Save reviewed as drafts</button><Link href="/shop">View the shop ↗</Link></section>}
 </main>;
}
