export type FilterOption = { label: string; values: string[] };
export type FilterCard = { set: string | null; rarity: string | null; holo_type: string | null; language: string | null };

function finishLabel(value: string): string | null {
  const key = value.toLowerCase().replace(/[\s_-]/g, '');
  if (['normal', 'nonholo', 'nonholofoil'].includes(key)) return 'Non-holo';
  if (['holo', 'holofoil', 'holorare', 'rareholo'].includes(key)) return 'Holo';
  if (['reverseholo', 'reverseholofoil'].includes(key)) return 'Reverse holo';
  if (['pokeballholo', 'masterballholo', 'cosmosholo'].includes(key)) return value.replace(/Holo$/i, 'holo');
  // Legacy scanners stored rarity/artwork categories here. Do not invent a finish.
  if (/rare|common|promo|art|radiant|ace\s*spec/i.test(value)) return null;
  return value;
}

export function buildShopFilters(cards: FilterCard[]) {
  function options(column: keyof FilterCard, labelFor: (value: string) => string | null = value => value) {
    const groups = new Map<string, FilterOption>();
    for (const card of cards) {
      const value = card[column];
      if (!value?.trim()) continue;
      const label = labelFor(value.trim());
      if (!label) continue;
      const key = label.toLowerCase();
      const option = groups.get(key) || { label, values: [] };
      if (!option.values.includes(value)) option.values.push(value);
      groups.set(key, option);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  return { sets: options('set'), rarities: options('rarity'), finishes: options('holo_type', finishLabel), languages: options('language') };
}
