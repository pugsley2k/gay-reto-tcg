export const CARD_CONDITIONS = [
  { value: 'Near Mint', description: 'Minimal wear. No creases or significant surface damage.' },
  { value: 'Lightly Played', description: 'Minor edge whitening, light scratches or small signs of handling.' },
  { value: 'Moderately Played', description: 'Noticeable edge wear, scratches or scuffing.' },
  { value: 'Heavily Played', description: 'Heavy wear, deep scratches or creasing.' },
  { value: 'Damaged', description: 'Tears, water damage, major bends or other structural damage.' },
] as const;
export function isCardCondition(value: unknown): value is typeof CARD_CONDITIONS[number]['value'] {
  return CARD_CONDITIONS.some(condition => condition.value === value);
}
