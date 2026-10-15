import test from 'node:test';
import assert from 'node:assert/strict';
import { orderEmail, validTracking } from './order-email';
const order = { id: 'test-order', items: [{ name: '<script>Card & name</script>', quantity: 1, price: 1000 }], shipping: { label: 'Royal Mail Tracked 48', price: 450, subtotal: 1000, total: 1450 } };
test('confirmation includes durable order details, totals and returns terms, safely escaped', () => {
  const email = orderEmail(order, 'confirmation');
  assert.ok(email.text.includes('£14.50'));
  assert.ok(email.text.includes('14 days'));
  assert.ok(email.text.includes('3–5 working days'));
  assert.ok(email.html.includes('&lt;script&gt;Card &amp; name&lt;/script&gt;'));
  assert.ok(!email.html.includes('<script>'));
});
test('tracking email uses a fixed carrier host and rejects injected links', () => {
  for (const tracking of ['https://evil.example', '<script>', '', 'A B C']) assert.equal(validTracking(tracking), false);
  assert.throws(() => orderEmail({ ...order, tracking: 'https://evil.example' }, 'tracking'));
  assert.ok(orderEmail({ ...order, tracking: 'AB123456789GB' }, 'tracking').html.includes('https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB'));
});
