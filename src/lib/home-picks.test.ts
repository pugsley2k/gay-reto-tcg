import test from 'node:test';
import assert from 'node:assert/strict';
import { weekIndex, weeklyPick } from './home-picks';
test('the weekly pick is stable within a week and changes on Monday', () => {
  const cards = [{ id: 'a', price: 500 }, { id: 'b', price: 900 }, { id: 'c', price: 100 }];
  const sunday = new Date('2026-11-15T23:59:00Z'), monday = new Date('2026-11-16T00:00:00Z'), wednesday = new Date('2026-11-18T12:00:00Z');
  assert.equal(weekIndex(monday), weekIndex(wednesday));
  assert.equal(weekIndex(monday), weekIndex(sunday) + 1);
  assert.equal(weeklyPick(cards, monday)?.id, weeklyPick([...cards].reverse(), wednesday)?.id);
  assert.notEqual(weeklyPick(cards, sunday)?.id, weeklyPick(cards, monday)?.id);
  assert.notEqual(weeklyPick(cards, monday)?.id, 'c');
});
test('the weekly pick falls back to cheap cards and handles an empty shop', () => {
  assert.equal(weeklyPick([{ id: 'x', price: 100 }])?.id, 'x');
  assert.equal(weeklyPick([]), null);
});
