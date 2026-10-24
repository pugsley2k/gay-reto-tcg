import {normaliseNumber,normaliseName,type ScanIdentity} from './card-catalog';
export type ArtCandidate={id:string;name:string;number:string;image_url:string};
export function selectArtCandidate(value:unknown,candidates:ArtCandidate[]){
 if(!value||typeof value!=='object')return null;
 const result=value as {id?:unknown;confidence?:unknown;conflict?:unknown};
 if(result.confidence!=='high'||result.conflict!==false||typeof result.id!=='string')return null;
 return candidates.find(c=>c.id===result.id)||null;
}
export async function findArtCandidates(scan:ScanIdentity):Promise<ArtCandidate[]>{
 const lang=({English:'en',Japanese:'ja',Korean:'ko'} as Record<string,string>)[scan.language];
 if(!lang||!scan.name)return[];
 const name=(scan.language==='English'?scan.name:scan.original_name||scan.name).trim();
 const params=new URLSearchParams({name,'pagination:page':'1','pagination:itemsPerPage':'100'});
 if(scan.number)params.set('localId',normaliseNumber(scan.number));
 const response=await fetch(`https://api.tcgdex.net/v2/${lang}/cards?${params}`,{next:{revalidate:3600},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Catalogue search is unavailable.');
 const list=await response.json() as {id:string;name:string;localId:string;image?:string}[];
 if(!Array.isArray(list)||list.length>=100)return[];
 const withImages=list.filter(c=>typeof c.id==='string'&&typeof c.name==='string'&&normaliseName(c.name)===normaliseName(name)&&typeof c.localId==='string'&&typeof c.image==='string'&&new RegExp(`^https://assets\\.tcgdex\\.net/${lang}/[A-Za-z0-9/_-]+$`).test(c.image));
 const numbered=scan.number?withImages.filter(c=>normaliseNumber(c.localId)===normaliseNumber(scan.number)):[];
 const narrowed=numbered.length?numbered:withImages;
 // Never silently choose from a truncated set of dozens of printings.
 if(narrowed.length>16)return[];
 return narrowed.map(c=>({id:c.id,name:c.name,number:c.localId,image_url:`${c.image}/high.webp`}));
}
