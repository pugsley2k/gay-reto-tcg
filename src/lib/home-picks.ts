/** Whole weeks since the Unix epoch, rolling over on Mondays (UTC). */
export function weekIndex(date = new Date()) {
  return Math.floor((date.getTime() / 86400000 + 3) / 7);
}
/** One card per week, the same for every visitor. Prefers cards of £3 or more so the feature has something worth showing. */
export function weeklyPick<T extends { id: string; price: number }>(cards: T[], date = new Date()): T | null {
  const featured = cards.filter(card => card.price >= 300);
  const pool = [...(featured.length ? featured : cards)].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pool.length ? pool[weekIndex(date) % pool.length] : null;
}
