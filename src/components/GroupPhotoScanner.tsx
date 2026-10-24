'use client';
import {useEffect,useRef,useState} from 'react';
import {prepareCardPhoto} from '@/lib/card-photo';
import {cropGroupPhoto} from '@/lib/group-card-photo';
import {MAX_GROUP_CARDS,validCardBox,validCardCorners,boxCorners,type CardCorners,type CardPoint,type CardBox} from '@/lib/group-card-detection';
import styles from './GroupPhotoScanner.module.css';
type Crop={id:string;box:CardBox;corners?:CardCorners;note:string;included:boolean};
export default function GroupPhotoScanner({disabled,remaining,onFiles,onBusy}:{disabled:boolean;remaining:number;onFiles:(files:File[],fingerprints:string[])=>Promise<boolean>;onBusy:(busy:boolean)=>void}){
 const [file,setFile]=useState<File|null>(null);const [source,setSource]=useState('');const [crops,setCrops]=useState<Crop[]>([]);
 const [previews,setPreviews]=useState<Record<string,string>>({});const [warnings,setWarnings]=useState<string[]>([]);const [error,setError]=useState('');
 const [detecting,setDetecting]=useState(false);const [preparing,setPreparing]=useState(false);const [adding,setAdding]=useState(false);const [checked,setChecked]=useState(false);const [message,setMessage]=useState('');
 const [straighten,setStraighten]=useState(true);const [placing,setPlacing]=useState<{id:string;points:CardPoint[]}|null>(null);const photoRef=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLInputElement>(null);const controller=useRef<AbortController|null>(null);const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{onBusy(detecting||adding);return()=>onBusy(false);},[detecting,adding,onBusy]);
 useEffect(()=>{if(!file){setSource('');return;}const url=URL.createObjectURL(file);setSource(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{
  let active=true;const urls:string[]=[];const visible=crops.filter(c=>c.included);setPreviews({});if(!file||!visible.length){setPreparing(false);return;}
  setPreparing(true);
  const timer=setTimeout(()=>{void cropGroupPhoto(file,visible.map(c=>c.box),visible.map(c=>c.corners),straighten).then(files=>{if(!active)return;const next:Record<string,string>={};files.forEach((file,index)=>{const url=URL.createObjectURL(file);urls.push(url);next[visible[index].id]=url;});setPreviews(next);}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Could not preview crops.');}).finally(()=>{if(active)setPreparing(false);});},200);
  return()=>{active=false;clearTimeout(timer);urls.forEach(url=>URL.revokeObjectURL(url));};
 },[file,crops,straighten]);
 const selected=crops.filter(c=>c.included);const busy=disabled||detecting||adding;
 async function detect(photo?:File){
  if(!photo||busy)return;setError('');setMessage('');setWarnings([]);setChecked(false);setCrops([]);setPlacing(null);setFile(null);setDetecting(true);
  const abort=new AbortController();controller.current=abort;
  try{
   const prepared=await prepareCardPhoto(photo);if(abort.signal.aborted)return;setFile(photo);
   const body=new FormData();body.append('image',prepared);const response=await fetch('/api/scan-group',{method:'POST',body,signal:abort.signal});const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Could not separate the cards.');if(abort.signal.aborted)return;
   setCrops(data.cards.filter((card:{box:CardBox})=>validCardBox(card.box)).map((card:{box:CardBox;corners?:CardCorners;note:string})=>({id:crypto.randomUUID(),...card,included:true})));
   setWarnings(data.warnings||[]);if(!data.cards.length)setError('No usable card crops were detected. Retake the photo or add a crop manually below.');
  }catch(error){if(!abort.signal.aborted&&mounted.current)setError(error instanceof Error?error.message:'Could not read this photo.');}
  finally{if(mounted.current&&!abort.signal.aborted)setDetecting(false);}
 }
 function edit(id:string,key:keyof CardBox,percent:number){
  if(!Number.isFinite(percent))return;setChecked(false);setError('');setCrops(prev=>prev.map(crop=>{
   if(crop.id!==id)return crop;const box={...crop.box,[key]:Math.round(percent*10)};
   box.x=Math.max(0,Math.min(980,box.x));box.y=Math.max(0,Math.min(980,box.y));box.width=Math.max(20,Math.min(1000-box.x,box.width));box.height=Math.max(20,Math.min(1000-box.y,box.height));return{...crop,box,corners:undefined};
  }));
 }
 function placePoint(event:React.MouseEvent<HTMLDivElement>){
  if(!placing||busy)return;
  const rect=event.currentTarget.getBoundingClientRect();const point={x:Math.round(Math.max(0,Math.min(1000,(event.clientX-rect.left)/rect.width*1000))),y:Math.round(Math.max(0,Math.min(1000,(event.clientY-rect.top)/rect.height*1000)))};
  const points=[...placing.points,point];setChecked(false);
  if(points.length<4){setPlacing({...placing,points});return;}
  if(!validCardCorners(points)){setError('Those corners cross or are too close. Start at top left, then top right, bottom right, bottom left.');setPlacing({...placing,points:[]});return;}
  const corners=points as CardCorners;const xs=points.map(p=>p.x),ys=points.map(p=>p.y);const box={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  setCrops(prev=>prev.map(c=>c.id===placing.id?{...c,box,corners}:c));setError('');setPlacing(null);
 }
 async function add(){
  if(!file||placing||busy||preparing||!checked||!selected.length||selected.some(c=>!previews[c.id])||selected.length>remaining)return;setAdding(true);setError('');
  try{
   const files=await cropGroupPhoto(file,selected.map(c=>c.box),selected.map(c=>c.corners),straighten);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');
   const accepted=await onFiles(files,selected.map(c=>`group:${hash}:${c.box.x},${c.box.y},${c.box.width},${c.box.height}`));
   if(accepted&&mounted.current){setMessage(`${files.length} selected crops sent to the review queue below. Nothing has been published.`);setFile(null);setCrops([]);setChecked(false);}
  }catch(error){if(mounted.current)setError(error instanceof Error?error.message:'Could not prepare the crops.');}finally{if(mounted.current)setAdding(false);}
 }
 return <section className={styles.panel} aria-label="Cards in one photo"><h2>Cards in one photo</h2><p>Lay cards face up, spaced apart on a plain surface. Start with 4–8 cards; up to {MAX_GROUP_CARDS} crops per photo. Keep every corner and slab label visible.</p>
 <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{void detect(e.target.files?.[0]);e.target.value='';}}/>
 <button type="button" disabled={busy||remaining===0} onClick={()=>input.current?.click()}>{detecting?'Finding cards…':file?'Choose another group photo':'Choose a group photo'}</button>
 <p>Detection can miss cards. Check the count, remove false detections and adjust crops before scanning. The group photo is sent to OpenAI for detection; only selected individual crops enter the listing queue.</p>
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}{warnings.length>0&&<ul>{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}
 {source&&<>
 <label className={styles.check}><input type="checkbox" checked={straighten} disabled={busy} onChange={e=>{setStraighten(e.target.checked);setChecked(false);}}/>Straighten cards and add a neutral photo border</label>
 <p>Uses the original photo pixels. No generated detail, colour filters or wear removal. Binder glare cannot be removed reliably. Retake blurry or reflective cards separately. These are sale photos, not condition assessments.</p>
 {placing&&<p role="status">Crop {crops.findIndex(c=>c.id===placing.id)+1}: tap the {['top left','top right','bottom right','bottom left'][placing.points.length]} corner on the photo. <button type="button" onClick={()=>setPlacing(null)}>Cancel corner adjustment</button></p>}
 <div ref={photoRef} className={`${styles.source} ${placing?styles.placing:''}`} onClick={placePoint}><img src={source} alt="Original group photo with numbered card crop outlines"/><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{crops.map((crop,index)=><g key={crop.id} opacity={crop.included?1:.3}><polygon points={(crop.corners||boxCorners(crop.box)).map(p=>`${p.x},${p.y}`).join(' ')}/><text x={crop.box.x+5} y={crop.box.y+30}>{index+1}</text></g>)}{placing?.points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="9"/>)}</svg></div>
 <p>{crops.length} crop{crops.length===1?'':'s'} shown · {selected.length} selected · {remaining} spaces in this batch. Numbering is for this photo.</p>
 <div className={styles.grid}>{crops.map((crop,index)=><article key={crop.id}><h3>Crop {index+1}</h3>{previews[crop.id]?<img src={previews[crop.id]} alt={`Individual card crop ${index+1}; check all corners and label`}/>:<p>{crop.included?'Preparing preview…':'Excluded from scanning'}</p>}
 <label className={styles.check}><input type="checkbox" checked={crop.included} disabled={busy} onChange={e=>{setChecked(false);setCrops(prev=>prev.map(c=>c.id===crop.id?{...c,included:e.target.checked}:c));}}/>Include crop {index+1}</label>{crop.note&&<p>{crop.note}</p>}
 <p>{straighten?(crop.corners?'Perspective corrected - check edges and detail':'Rectangle only - set four corners to straighten'):'Original rectangular crop'}</p>
 <button type="button" disabled={busy} onClick={()=>{setPlacing({id:crop.id,points:[]});setChecked(false);photoRef.current?.scrollIntoView({behavior:'instant',block:'center'});}}>Set four corners for crop {index+1}</button>
 <details><summary>Adjust crop {index+1}</summary><p>Percent of the original photo, measured from its top left.</p><div className={styles.fields}>{(['x','y','width','height'] as const).map(key=><label key={key}>{({x:'Left',y:'Top',width:'Width',height:'Height'})[key]} (%)<input type="number" min={key==='x'||key==='y'?0:2} max="100" step="0.1" disabled={busy} value={crop.box[key]/10} onChange={e=>edit(crop.id,key,Number(e.target.value))}/></label>)}</div><p>Changing the rectangle resets perspective corners. Fine-tune corners below, or tap -Set four corners-.</p>{crop.corners&&<div className={styles.fields}>{crop.corners.map((point,cornerIndex)=><fieldset key={cornerIndex}><legend>{['Top left','Top right','Bottom right','Bottom left'][cornerIndex]}</legend>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()} (%)<input type="number" min="0" max="100" step="0.1" disabled={busy} value={point[axis]/10} onChange={e=>{const n=Number(e.target.value)*10;if(!Number.isFinite(n))return;const corners=crop.corners!.map((p,i)=>i===cornerIndex?{...p,[axis]:n}:p) as CardCorners;if(!validCardCorners(corners)){setError('Corners must stay within the photo and must not cross.');return;}setChecked(false);setError('');setCrops(prev=>prev.map(c=>c.id===crop.id?{...c,corners}:c));}}/></label>)}</fieldset>)}</div>}</details>
 </article>)}</div>
 <button type="button" disabled={busy||crops.length>=MAX_GROUP_CARDS} onClick={()=>{setChecked(false);setError('');setCrops(prev=>[...prev,{id:crypto.randomUUID(),box:{x:250,y:250,width:300,height:450},note:'Manually added crop — adjust its position and size.',included:true}]);}}>Add a missed card crop</button>
 <label className={styles.check}><input type="checkbox" checked={checked} disabled={busy||preparing||!selected.length||selected.some(c=>!previews[c.id])} onChange={e=>setChecked(e.target.checked)}/>I checked the count and every selected crop includes the whole card or slab label</label>
 {selected.length>remaining&&<p role="alert">Select at most {remaining} cards or finish the current batch first.</p>}
 <button type="button" disabled={!!placing||busy||preparing||!checked||!selected.length||selected.some(c=>!previews[c.id])||selected.length>remaining} onClick={()=>void add()}>{adding?'Preparing selected cards…':`Scan ${selected.length} selected card${selected.length===1?'':'s'}`}</button>
 </>}
 </section>;
}
