import type {Grading} from './card-grading';
import {normal,officialCertUrl,parseGetGraded,compareCertificate,type CertIdentity,type CertRecord,type CertResult} from './cert-record';
export async function verifyCertificate(grading:Grading,card:CertIdentity):Promise<CertResult>{
 const url=officialCertUrl(grading.company,grading.cert_number);const checked_at=new Date().toISOString();
 const unavailable=(message:string):CertResult=>({status:'unavailable',message,url,checked_at});
 try{
 let record:CertRecord|null=null;
 if(normal(grading.company)==='getgraded'&&/^\d{8}$/.test(grading.cert_number)){
  const response=await fetch(url!,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return unavailable('GetGraded’s checker is unavailable. Use the official lookup to check manually.');
  const html=await response.text();if(html.length>2000000)return unavailable('The official checker returned an unexpected response. Check manually.');
  record=parseGetGraded(html,grading.cert_number);
 }else if(normal(grading.company)==='psa'&&process.env.PSA_API_TOKEN){
  const response=await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(grading.cert_number)}`,{headers:{Authorization:`Bearer ${process.env.PSA_API_TOKEN}`},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return unavailable('PSA’s API could not complete the check. Use the official lookup.');
  const {PSACert:c}=await response.json();if(c&&typeof c.CertNumber==='string')record={company:'PSA',cert_number:c.CertNumber,name:String(c.Subject||''),number:String(c.CardNumber||''),set:String(c.Brand||''),grade:String(c.CardGrade||''),year:String(c.Year||''),description:String(c.Variety||'')};
 }else return unavailable(normal(grading.company)==='psa'?'Automatic PSA checks need a connected PSA API token. Open the official record and compare it manually.':'Automatic verification is not connected for this company. Open its official checker and compare the card, number, set and grade.');
 if(!record)return unavailable('No readable matching certificate record was returned. This is not a finding that the slab is fake; check the number and official site manually.');
 return{...compareCertificate(record,grading,card),record,url,checked_at};
 }catch{return unavailable('The official checker could not be reached or read. Retry, or check its website manually.');}
}
