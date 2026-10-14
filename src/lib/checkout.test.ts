import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckout, priceCheckout } from './checkout';

test('checkout uses inventory prices regardless of browser price', () => {
  const ids = validateCheckout([{ cardId: 'a', quantity: 1, price_data: { unit_amount: 1 } }]);
  assert.equal(priceCheckout(ids, [{ id: 'a', name: 'Pikachu', price: 1299, available: true }]).total, 1299);
});
test('duplicate cards, invalid quantities and malformed carts are rejected', () => {
  for (const items of [null, [], [{ cardId: 'a', quantity: -1 }], [{ cardId: 'a', quantity: 1 }, { cardId: 'a', quantity: 1 }]]) {
    assert.throws(() => validateCheckout(items));
  }
});
test('missing or sold cards cannot be purchased', () => {
  assert.throws(() => priceCheckout(['missing'], []));
  assert.throws(() => priceCheckout(['sold'], [{ id: 'sold', name: 'Mew', price: 400, available: false }]));
});
test('minimum order and integer prices are enforced', () => {
  for (const price of [1, -1, 99.5, Number.NaN]) {
    assert.throws(() => priceCheckout(['a'], [{ id: 'a', name: 'Mew', price, available: true }]));
  }
});
