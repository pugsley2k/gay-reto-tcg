export type SocialCard = { id:string;name:string;price:number;available:boolean;sold_at:string|null;updatedAt:string;set:string|null;number:string|null;condition:string|null;grading?:{company?:string;grade?:string;confirmed?:boolean}|null };
export function makeTikTokPack(card:SocialCard,now=new Date()) {
  if(!card.available||card.sold_at||card.id==='demo-gardevoir-ex'||!Number.isSafeInteger(card.price)||card.price<30)throw new Error('Choose an available card with a valid price.');
  const url=`https://www.gayretrotcg.com/cards/${encodeURIComponent(card.id)}`;
  const facts=[card.name,card.set,card.number?`#${card.number}`:null,card.grading?.confirmed?`${card.grading.company} ${card.grading.grade}`:card.condition].filter(Boolean).join(' · ');
  return {version:1,brand:'Gay Retro TCG',mode:'tiktok-inbox',createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+86400000).toISOString(),card:{id:card.id,name:card.name,price:card.price,updatedAt:card.updatedAt},url,caption:`${facts}\n£${(card.price/100).toFixed(2)} · UK delivery\nSee current availability: ${url}\n#PokemonTCG #PokemonCards #CardCollector #GayRetroTCG`,instructions:'Use your own footage of this actual card. Confirm the TikTok account before sending. Finish publishing from the TikTok inbox.'};
}
