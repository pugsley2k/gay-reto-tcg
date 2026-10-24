'use client';
import {useEffect,useRef,useState} from 'react';
import {prepareCardPhoto} from '@/lib/card-photo';
import {parseGroupIdentities,type GroupCardIdentity} from '@/lib/group-card-identity';
import styles from './GroupPhotoScanner.module.css';
export default function GroupIdentityScanner({disabled,remaining,onCards,onBusy}:{disabled:boolean;remaining:number;onCards:(file:File,cards:GroupCardIdentity[])=>void;onBusy:(busy:boolean)=>void}){
 const input=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null);const [busy,setBusy]=useState(false),[error,setError]=useState(''),[warnings,setWarnings]=useState<string[]>([]);
 useEffect(()=>()=>abort.current?.abort(),[]);
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 async function identify(file?:File){if(!file||disabled||busy)return;setBusy(true);setError('');setWarnings([]);const controller=new AbortController();abort.current=controller;
  try{const prepared=await prepareCardPhoto(file),body=new FormData();body.append('image',prepared);const response=await fetch('/api/scan-collection',{method:'POST',body,signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not identify the cards.');const parsed=parseGroupIdentities(result);setWarnings(parsed.warnings);if(!parsed.cards.length)throw new Error('No cards were identified. Try a clearer photo.');if(parsed.cards.length>remaining)throw new Error(`Only ${remaining} spaces remain in this batch. Finish this batch or photograph fewer cards.`);onCards(prepared,parsed.cards);
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Could not read the photo.');}finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <section className={styles.panel} aria-label="Identify cards from one photo"><h2>Identify cards from one photo</h2><p>Photograph up to 12 cards with their artwork visible. Readable names and numbers help distinguish similar printings. We compare artwork with catalogue images, use readable details to distinguish printings, and look up set and price. Clear matches are ready for batch publishing; ambiguous cards are skipped automatically.</p><p>Ungraded cards default to Near Mint (your seller setting, not an AI grade). Cards under £20 use matched catalogue artwork. Cards priced at £20 or more, graded cards, and cards without matching artwork need an individual photo. Your group photo is used for recognition only and is never published.</p><input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void identify(e.target.files?.[0]);e.target.value='';}}/><button type="button" disabled={disabled||busy||remaining===0} onClick={()=>input.current?.click()}>{busy?'Identifying cards…':'Identify cards from a photo'}</button>{error&&<p role="alert">{error}</p>}{warnings.length>0&&<ul>{warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}</section>;
}
