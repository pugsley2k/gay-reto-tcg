import { isCardEdition } from './card-edition';
import { isCardCondition } from './card-condition';
import { readGrading, completeGrading } from './card-grading';
import {isCardArtwork} from './card-artwork';
import {listingPhotoIssue} from './listing-photo-policy';
export function validateListing(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Invalid card details.');
  const value = input as Record<string, unknown>;
  function text(key: string, max: number, required = false) {
    const field = value[key];
    if (field == null && !required) return null;
    if (typeof field !== 'string' || field.trim().length > max || (required && !field.trim())) throw new Error(`Invalid ${key.replaceAll('_', ' ')}.`);
    return field.trim();
  }
  const name = text('name', 200, true);
  const grading = readGrading(value.grading);
  if (value.grading != null && (!grading || !completeGrading(grading) || !grading.confirmed)) throw new Error('Check and confirm the grading company, full grade and certification number.');
  const image = text('image_url', 2048, true)!;
  const imageUrl = new URL(image);
  if (imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password) throw new Error('Use a secure image URL.');
  if (!Number.isSafeInteger(value.price) || (value.price as number) < 0 || (value.price as number) > 10000000) throw new Error('Price must be whole pence between £0 and £100,000.');
  if (typeof value.available !== 'boolean') throw new Error('Choose whether this card is available.');
  if (!['English','Japanese','Korean'].includes(String(value.language))) throw new Error('Choose a supported language.');
  const condition = text('condition', 40);
  if (condition && !isCardCondition(condition)) throw new Error('Choose a supported card condition.');
  const edition = text('edition', 40);
  if (edition && !isCardEdition(edition)) throw new Error('Choose a supported edition.');
  function photo(key: string) {
    const value = text(key, 2048);
    if (!value) return null;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a secure photo URL.');
    return value;
  }
  if (grading && !photo('front_image_url')) throw new Error('Add a front photograph of the actual slab.');
  if(value.available){const issue=listingPhotoIssue(value.price as number,!!grading,!!photo('front_image_url'),isCardArtwork(image));if(issue)throw new Error(issue);}
  return { grading, edition: edition || null, condition: grading ? null : condition || null, name, image_url: image, price: value.price as number, available: value.available,
    front_image_url: photo('front_image_url'), back_image_url: photo('back_image_url'),
    number: text('number', 40), set: text('set', 160), rarity: text('rarity', 100),
    scan_url: text('scan_url', 2048), language: value.language as string, holo_type: text('holo_type', 100) };
}
