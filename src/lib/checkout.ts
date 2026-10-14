import { EXAMPLE_CARD_ID } from './example-listing';
export type StockCard = { id: string; name: string; price: number; available: boolean };
export function validateCheckout(items: unknown) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('Choose between 1 and 100 cards.');
  const ids: string[] = [];
  for (const item of items) {
    if (!item || typeof item.cardId !== 'string' || !item.cardId || item.quantity !== 1 || ids.includes(item.cardId)) {
      throw new Error('Each card can be purchased once per order.');
    }
    ids.push(item.cardId);
  }
  return ids;
}
export function priceCheckout(ids: string[], cards: StockCard[]) {
  if (ids.includes(EXAMPLE_CARD_ID)) throw new Error('The example card is for display only and cannot be purchased.');
  const ordered = ids.map(id => cards.find(card => card.id === id));
  if (ordered.some(card => !card || !card.available || !Number.isSafeInteger(card.price) || card.price < 0)) {
    throw new Error('A card is no longer available. Refresh your cart and try again.');
  }
  const stock = ordered as StockCard[];
  const total = stock.reduce((sum, card) => sum + card.price, 0);
  if (!Number.isSafeInteger(total) || total < 30) throw new Error('The minimum order is £0.30.');
  return { total, summary: stock.map(card => ({ id: card.id, name: card.name, quantity: 1 })) };
}
