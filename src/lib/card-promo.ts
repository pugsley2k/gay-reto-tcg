import {isCardArtwork} from './card-artwork';
export type PromoCard = {
  id:string; name:string; price:number; available:boolean; sold_at:string|null;
  image_url:string|null; front_image_url:string|null; back_image_url:string|null; set:string|null; number:string|null;
  condition:string|null; grading?:{company?:string;grade?:string;confirmed?:boolean}|null;
};
export type PromoStyle = 'gold'|'ember'|'tidal'|'neon';
export const PROMO_SECONDS = 8;
export function promoStyle(name:string):PromoStyle {
  if (/charizard|charmander|charmeleon|arcanine|vulpix/i.test(name)) return 'ember';
  if (/tentacruel|squirtle|blastoise|gyarados|lapras/i.test(name)) return 'tidal';
  if (/mew|gengar|espeon|mewtwo/i.test(name)) return 'neon';
  return 'gold';
}
export function makeCardPromo(card:PromoCard,revision:number) {
  if (!card.available || card.sold_at || card.id.startsWith('demo-') || !Number.isSafeInteger(card.price) || card.price<30 || !isCardArtwork(card.image_url)) throw new Error('This promo needs an available listing, a valid price and matching catalogue artwork. Refresh the catalogue image in Manage cards. Uploaded photos are never used.');
  const price=`£${(card.price/100).toFixed(2)}`;
  const facts=[card.set,card.number?`#${card.number}`:null,card.grading?.confirmed?[card.grading.company,card.grading.grade].filter(Boolean).join(' '):card.condition].filter(Boolean).join(' · ');
  const url=`https://www.gayretrotcg.com/cards/${encodeURIComponent(card.id)}`;
  return {cardId:card.id,revision,name:card.name,price,facts,url,style:promoStyle(card.name),seconds:PROMO_SECONDS,
    artwork:`/api/admin/card-promos/image?cardId=${encodeURIComponent(card.id)}&revision=${revision}`,
    caption:`Now available: ${card.name}${facts?` · ${facts}`:''}\n${price} + delivery. One physical card.\nCheck current price and availability: ${url}\n#PokemonTCG #PokemonCards #CardCollector #GayRetroTCG`};
}
export type CardPromo = ReturnType<typeof makeCardPromo>;
export const allowedPromoImage=isCardArtwork;
