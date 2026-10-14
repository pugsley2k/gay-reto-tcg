import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShopFilters } from './shop-filters';

test('finish aliases match every original database value without rewriting stock', () => {
  const cards = ['Holo Rare', 'Rare Holo', 'reverseHolofoil', 'Reverse Holo', 'Normal'].map(holo_type => ({ set: 'Base Set', rarity: 'Rare', language: 'English', holo_type }));
  const filters = buildShopFilters(cards);
  assert.deepEqual(filters.finishes.find(x => x.label === 'Holo')?.values, ['Holo Rare', 'Rare Holo']);
  assert.deepEqual(filters.finishes.find(x => x.label === 'Reverse holo')?.values, ['reverseHolofoil', 'Reverse Holo']);
  assert.equal(filters.sets.length, 1);
  assert.equal(filters.rarities.length, 1);
});
test('rarity metadata is not guessed to be a physical finish', () => {
  const filters = buildShopFilters([{ set: null, rarity: 'Special Illustration Rare', language: null, holo_type: 'Special Illustration Rare' }, { set: '', rarity: null, language: '', holo_type: null }]);
  assert.deepEqual(filters.finishes, []);
  assert.deepEqual(filters.sets, []);
  assert.equal(filters.rarities[0].label, 'Special Illustration Rare');
});
