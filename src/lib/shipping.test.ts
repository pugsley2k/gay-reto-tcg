import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingOptions, requireShipping, isUKShippingOrder } from './shipping';
test('tracked services cannot under-cover a higher-value order', () => {
  assert.equal(shippingOptions(7500, 1).length, 3);
  assert.deepEqual(shippingOptions(7501, 1).map(x => x.id), ['special-delivery']);
  assert.throws(() => requireShipping(7501, 1, 'tracked-48'));
  assert.equal(requireShipping(75001, 1, 'special-delivery').compensation, 100000);
  assert.equal(requireShipping(100001, 1, 'special-delivery').compensation, 250000);
  assert.throws(() => requireShipping(250001, 1, 'special-delivery'));
});
test('postage uses order size and never accepts a client price or invalid method', () => {
  assert.equal(requireShipping(500, 1, 'tracked-48').price, 450);
  assert.ok(requireShipping(9000, 100, 'special-delivery').price > requireShipping(9000, 1, 'special-delivery').price);
  assert.throws(() => requireShipping(500, 1, { id: 'tracked-48', price: 0 }));
  for (const count of [0, -1, 1.5, 101]) assert.deepEqual(shippingOptions(500, count), []);
});
test('missing, overseas and multiple shipping addresses cannot be captured', () => {
  assert.ok(isUKShippingOrder({ purchase_units: [{ shipping: { address: { country_code: 'GB' } } }] }));
  for (const country_code of ['US', 'JE', 'IM', undefined]) assert.equal(isUKShippingOrder({ purchase_units: [{ shipping: { address: { country_code } } }] }), false);
  assert.equal(isUKShippingOrder({}), false);
  assert.equal(isUKShippingOrder({ purchase_units: [{ shipping: { address: { country_code: 'GB' } } }, {}] }), false);
});
