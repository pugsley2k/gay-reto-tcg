export const MEW_CODE = 'MEW5';
export function promoDiscount(subtotal: number, input: unknown) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new Error('Invalid card subtotal.');
  if (input === undefined || input === null || input === '') return { code: null, amount: 0 };
  if (typeof input !== 'string' || input.trim().toUpperCase() !== MEW_CODE) throw new Error('That gift code is not recognised.');
  return { code: MEW_CODE, amount: Math.round(subtotal * 5 / 100) };
}
