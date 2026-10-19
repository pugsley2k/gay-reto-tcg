import {isPriceChartingArtwork} from './pricecharting-import';
/** Catalogue artwork is display media; condition evidence stays in front/back photographs. */
export function isCardArtwork(value:unknown):value is string {
  return typeof value==='string' && (/^https:\/\/assets\.tcgdex\.net\/(en|ja|ko)\/[A-Za-z0-9/_-]+\/(high|low)\.webp$/.test(value) || /^https:\/\/images\.pokemontcg\.io\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.png$/.test(value) || isPriceChartingArtwork(value));
}
export const listingArtwork=(card:{image_url?:string|null})=>isCardArtwork(card.image_url)?card.image_url:'/placeholder.png';
