export const CARD_EDITIONS = ['1st Edition', 'Unlimited', 'Not applicable'] as const;
export function isCardEdition(value: unknown): value is typeof CARD_EDITIONS[number] {
  return CARD_EDITIONS.some(edition => edition === value);
}
