import {isPriceChartingArtwork} from './pricecharting-import';
/** Catalogue artwork is display media; condition evidence stays in front/back photographs. */
export function isCardArtwork(value:unknown):value is string {
  return typeof value==='string' && (/^https:\/\/assets\.tcgdex\.net\/(en|ja|ko)\/[A-Za-z0-9/_-]+\/(high|low)\.webp$/.test(value) || /^https:\/\/images\.pokemontcg\.io\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.png$/.test(value) || isPriceChartingArtwork(value));
}
/** The seller's own photo of the card, stored in the shop's card-photos bucket. */
export function isListingPhoto(value:unknown):value is string {
  return typeof value==='string' && /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/card-photos\/[A-Za-z0-9._/-]+$/.test(value);
}
type Listing={image_url?:string|null;front_image_url?:string|null};
/** Catalogue artwork when there is some, else the photo of the actual card, else the shop placeholder. */
export const listingArtwork=(card:Listing)=>isCardArtwork(card.image_url)?card.image_url:isListingPhoto(card.front_image_url)?card.front_image_url:'/placeholder.png';
/** True when the listing is shown with the photo of the actual card rather than catalogue artwork. */
export const showsListingPhoto=(card:Listing)=>!isCardArtwork(card.image_url)&&isListingPhoto(card.front_image_url);
