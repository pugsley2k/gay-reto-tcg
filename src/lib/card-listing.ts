import { isCardEdition } from './card-edition';
import { isCardCondition } from './card-condition';
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
  return { edition: edition || null, condition: condition || null, name, image_url: image, price: value.price as number, available: value.available,
    number: text('number', 40), set: text('set', 160), rarity: text('rarity', 100),
    scan_url: text('scan_url', 2048), language: value.language as string, holo_type: text('holo_type', 100) };
}
