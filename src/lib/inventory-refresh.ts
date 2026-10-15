import {EXAMPLE_CARD_ID} from './example-listing';
export type RefreshCard={id:string;name:string;number:string|null;set:string|null;language:string|null;holo_type:string|null;edition:string|null};
export type RefreshResult={matched:boolean;set?:string;image_url?:string|null;notice?:string;pricing?:{gbp:string;source:string;updated:string}|null;candidates?:{id:string;set:string}[]};
const normalise=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function inventoryIdentity(card:RefreshCard){
 let name=card.name.trim();
 if(card.id===EXAMPLE_CARD_ID)name=name.replace(/^EXAMPLE\s*[—–-]\s*/i,'').replace(/\s*\(not for sale\)\s*$/i,'').trim();
 const printing=(card.number||'').trim();
 if(!printing)throw new Error('Add the card number before looking up its price and image.');
 const escaped=printing.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const marker=new RegExp(`\\s+#?${escaped}(?=\\s|$)`).exec(name);
 const after=marker?name.slice(marker.index+marker[0].length).trim():'';
 if(marker)name=name.slice(0,marker.index).trim();
 const set=card.set?.trim()||after.split(' | ')[0].trim();
 return{name,original_name:name,number:printing.split('/')[0],total:printing.split('/')[1]||undefined,set,language:card.language||'English',finish:card.holo_type,edition:card.edition};
}
export function matchingPrinting(result:RefreshResult,set:string){const candidates=result.candidates?.filter(candidate=>normalise(candidate.set)===normalise(set))||[];return set&&candidates.length===1?candidates[0].id:null;}
export function inventoryUpdates(result:RefreshResult,set:string){
 if(!result.matched)throw new Error(result.notice||'No exact catalogue match. Check the name, number, set and language.');
 if(set&&normalise(result.set||'')!==normalise(set))throw new Error('The catalogue matched a different set. Nothing was changed; check the listing details.');
 const updates:{image_url?:string;price?:number}={};
 if(result.image_url)updates.image_url=result.image_url;
 if(result.pricing&&/^\d+(\.\d{1,2})?$/.test(result.pricing.gbp)){const price=Math.round(Number(result.pricing.gbp)*100);if(Number.isSafeInteger(price)&&price>0&&price<=10000000)updates.price=price;}
 return updates;
}
