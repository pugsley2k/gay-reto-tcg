'use client';
import {useEffect,useRef,useState} from 'react';
import type {Grading} from '@/lib/card-grading';
import {officialCertUrl,type CertIdentity,type CertResult} from '@/lib/cert-record';
export default function CertificateCheck({grading,card,onChecked}:{grading:Grading;card:CertIdentity;onChecked:(mismatch:boolean)=>void}){
 const [result,setResult]=useState<CertResult|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const abort=useRef<AbortController|null>(null);useEffect(()=>()=>abort.current?.abort(),[]);
 const url=officialCertUrl(grading.company,grading.cert_number);
 async function check(){if(busy)return;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
 try{const response=await fetch('/api/admin/verify-cert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...card,grading}),signal:controller.signal});const data=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(data.error||'Check failed.');setResult(data);onChecked(data.status==='mismatch');}
 catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Could not check the certificate.');}finally{if(!controller.signal.aborted)setBusy(false);}}
 return <div><button type="button" onClick={()=>void check()} disabled={busy||!grading.company||!grading.cert_number||!card.name||!card.number||!card.set}>{busy?'Checking official certificate…':'Check certificate with grading company'}</button>
 {url&&<p><a href={url} target="_blank" rel="noopener noreferrer">Open official {grading.company} checker ↗</a></p>}
 <div aria-live="polite">{error&&<p role="alert">{error}</p>}{result&&<><p><strong>{result.status==='matched'?'Official record matches':result.status==='mismatch'?'Details do not match':'Not automatically verified'}</strong></p><p>{result.message}</p>{result.record&&<p>{result.record.name} · {result.record.number} · {result.record.set} {result.record.year} · {result.record.company} {result.record.grade} · Cert {result.record.cert_number}</p>}</>}</div>
 </div>;
}
