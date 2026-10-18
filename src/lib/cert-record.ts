import type {Grading} from './card-grading';
export type CertIdentity={name:string;number:string;set:string};
export type CertRecord={company:string;cert_number:string;name:string;number:string;set:string;grade:string;year?:string;description?:string};
export type CertResult={status:'matched'|'mismatch'|'review'|'unavailable';message:string;url:string|null;record?:CertRecord;differences?:string[];checked_at:string};
export const normal=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function officialCertUrl(company:string,cert:string){
 const id=encodeURIComponent(cert);switch(normal(company)){
 case 'getgraded':return `https://www.getgraded.co.uk/cert-checker/?cert=${id}`;
 case 'psa':return `https://www.psacard.com/cert/${id}`;
 case 'cgc':return `https://www.cgccards.com/certlookup/${id}/`;
 case 'bgs':case 'beckett':return 'https://www.beckett.com/';
 case 'sgc':return 'https://www.gosgc.com/cert-code-lookup';
 case 'tag':return 'https://taggrading.com/search';
 default:return null;
 }}
const clean=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/&#8211;|&#8212;|&ndash;|&mdash;/g,'–').replace(/&amp;/g,'&').replace(/&#39;|&#039;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function parseGetGraded(html:string,cert:string):CertRecord|null{
 const visible=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const title=visible.match(/<div\b[^>]*class=["'][^"']*\bcard_name\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
 if(!title||!clean(visible).split(/\s+/).includes(cert))return null;
 const parts=clean(title[1]).split(/\s+[–—]\s+/);
 const section=visible.slice((title.index||0)+title[0].length).split(/Graders Notes|Population/i)[0];
 const grade=section.match(/class=["'][^"']*\bvalues\b[^"']*["'][^>]*>\s*([^<]+)</i);
 if(parts.length!==4||!grade)return null;
 return {company:'GetGraded',cert_number:cert,name:parts[0],number:parts[1],year:parts[2],set:parts[3],grade:clean(grade[1])};
}
function gradeValue(text:string){return text.toLowerCase().replace(/\b(?:excellent|very good|good|poor|fair|near mint|mint|gem mint|gem|nm|ex|vg)\b/g,'').replace(/\s+/g,'').trim();}
export function compareCertificate(record:CertRecord,grading:Grading,card:CertIdentity):Pick<CertResult,'status'|'message'|'differences'>{
 const differences:string[]=[];
 for(const field of ['company','cert_number'] as const)if(normal(record[field])!==normal(grading[field]))differences.push(field==='company'?'grading company':'certificate number');
 for(const field of ['name','set'] as const)if(normal(record[field])!==normal(card[field]))differences.push(field==='name'?'card name':'set');
 const number=card.number.split('/')[0];if(normal(record.number.split('/')[0])!==normal(number))differences.push('card number');
 if(card.number.includes('/')&&record.number.includes('/')&&normal(card.number)!==normal(record.number))differences.push('printed card total');
 if(gradeValue(record.grade)!==gradeValue(grading.grade))differences.push('grade or designation');
 if(differences.length)return{status:'mismatch',message:`The official record differs from your scan: ${differences.join(', ')}. Check the record and correct the details before publishing.`,differences};
 if(!card.name||!card.number||!card.set||!record.name||!record.number||!record.set||!record.grade)return{status:'review',message:'Official record found, but some details are missing. Compare the record manually.'};
 return{status:'matched',message:'Official record matches the card name, number, set and grade. Compare its photos with your slab. This checks the registry record; it does not authenticate the physical slab or establish language/edition variants absent from the record.'};
}
