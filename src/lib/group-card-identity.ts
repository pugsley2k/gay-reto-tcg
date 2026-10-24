export type GroupCardIdentity={name:string;original_name:string;card_number:string;card_total:string;language:string;edition:string;finish:string;position:string;slab:boolean;warning:string};
export function parseGroupIdentities(value:unknown):{cards:GroupCardIdentity[];warnings:string[]}{
 if(!value||typeof value!=='object'||!Array.isArray((value as {cards?:unknown}).cards))throw new Error('Could not read the cards. Try a clearer photo.');
 const input=value as {cards:unknown[];warnings?:unknown};
 const text=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
 const cards=input.cards.slice(0,12).flatMap(entry=>{if(!entry||typeof entry!=='object')return[];const item=entry as Record<string,unknown>;return[{name:text(item.name),original_name:text(item.original_name),card_number:text(item.card_number,40),card_total:text(item.card_total,40),language:['English','Japanese','Korean'].includes(String(item.language))?String(item.language):'',edition:text(item.edition,40),finish:text(item.finish,40),position:text(item.position,80),slab:item.slab===true,warning:text(item.warning,400)}];});
 const warnings=Array.isArray(input.warnings)?input.warnings.filter((v):v is string=>typeof v==='string').slice(0,6).map(v=>v.slice(0,400)):[];
 if(input.cards.length>12)warnings.push('Only the first 12 cards are shown. Photograph the remaining cards separately.');
 return{cards,warnings};
}
