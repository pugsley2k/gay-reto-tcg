export type CartProduct = { id: string; name: string; price: number; imageUrl: string; condition?: string | null; edition?: string | null };
export type CartItem = CartProduct & { quantity: number };

// Browser storage is optional and untrusted. Keep valid saved physical cards,
// with one copy of each, without letting a damaged entry break the storefront.
export function parseSavedCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(); const cards: CartItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 200 || seen.has(item.id)
      || typeof item.name !== 'string' || !item.name || !Number.isSafeInteger(item.price) || item.price < 0
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1) continue;
    seen.add(item.id);
    cards.push({ id: item.id, name: item.name, price: item.price, quantity: 1, imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
      condition: typeof item.condition === 'string' ? item.condition : null, edition: typeof item.edition === 'string' ? item.edition : null });
    if (cards.length === 100) break;
  }
  return cards;
}
