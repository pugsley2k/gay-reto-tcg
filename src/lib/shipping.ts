export const CONTACT_EMAIL = 'gayretrotcg@gmail.com';
/** Card subtotal (before gift codes) at which Royal Mail Tracked 48 becomes free. */
export const FREE_POSTAGE_PENCE = 3000;
export type ShippingMethod = 'tracked-48' | 'tracked-24' | 'special-delivery';
export type ShippingQuote = { id: ShippingMethod; label: string; price: number; compensation: number; deliveryAim: string };
export function shippingOptions(subtotal: number, cardCount: number): ShippingQuote[] {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isSafeInteger(cardCount) || cardCount < 1 || cardCount > 100) return [];
  if (subtotal > 250000) return [];
  // Conservative allowance for sleeved singles and packaging. Weigh before posting.
  const estimatedGrams = 100 + cardCount * 15;
  const band = estimatedGrams <= 500 ? 0 : estimatedGrams <= 1000 ? 1 : 2;
  const cover = subtotal <= 75000 ? 75000 : subtotal <= 100000 ? 100000 : 250000;
  // Customer postage + packing prices, based on online Royal Mail rates checked 14 Oct 2026.
  const specialPrices = cover === 75000 ? [1195, 1295, 1705] : cover === 100000 ? [1495, 1595, 2005] : [2195, 2295, 2705];
  const special: ShippingQuote = { id: 'special-delivery', label: 'Royal Mail Special Delivery', price: specialPrices[band], compensation: cover, deliveryAim: 'Usually next working day after posting; postcode exceptions apply' };
  if (subtotal > 7500) return [special];
  return [
    { id: 'tracked-48', label: 'Royal Mail Tracked 48', price: subtotal >= FREE_POSTAGE_PENCE ? 0 : 450, compensation: 7500, deliveryAim: 'Usually 2–3 working days after dispatch' },
    { id: 'tracked-24', label: 'Royal Mail Tracked 24', price: 575, compensation: 7500, deliveryAim: 'Next working day aim after dispatch' },
    special,
  ];
}
export function requireShipping(subtotal: number, cardCount: number, method: unknown) {
  const quote = shippingOptions(subtotal, cardCount).find(option => option.id === method);
  if (!quote) throw new Error(subtotal > 250000 ? 'Please email us to arrange delivery for orders over £2,500.' : 'Choose an available delivery service for this order.');
  return quote;
}
export function isUKShippingOrder(order: { purchase_units?: { shipping?: { address?: { country_code?: string } } }[] }) {
  return order.purchase_units?.length === 1 && order.purchase_units[0].shipping?.address?.country_code === 'GB';
}
/** Pence still needed for free Tracked 48, or 0 once unlocked. Null when the order is too large for Tracked 48. */
export function freePostageGap(subtotal: number) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 7500) return null;
  return Math.max(0, FREE_POSTAGE_PENCE - subtotal);
}
