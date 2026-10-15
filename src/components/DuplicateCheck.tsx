'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
export default function DuplicateCheck({name,number,set,language}:{name:string;number:string;set:string;language:string}){
 const [matches,setMatches]=useState<{id:string;name:string}[]>([]),[error,setError]=useState('');
 useEffect(()=>{setMatches([]);setError('');if(!name.trim()||!number.trim())return;const controller=new AbortController();const timer=setTimeout(()=>{fetch('/api/admin/duplicates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,number,set,language}),signal:controller.signal}).then(async res=>{const data=await res.json();if(!res.ok)throw Error();setMatches(data.matches||[]);}).catch(()=>{if(!controller.signal.aborted)setError('Stock duplicate check unavailable. Check existing listings before publishing.');});},350);return()=>{clearTimeout(timer);controller.abort();};},[name,number,set,language]);
 return error?<p role="status">{error}</p>:matches.length?<aside role="status"><strong>Possible duplicate: {matches.length} matching listing{matches.length===1?'':'s'} in stock.</strong><p>Check this is another physical copy before publishing. Edition or finish may differ.</p>{matches.map(card=><Link key={card.id} href={`/cards/${encodeURIComponent(card.id)}`} target="_blank" rel="noreferrer" style={{marginRight:16,color:'inherit'}}>View {card.name} ↗</Link>)}</aside>:null;
}
