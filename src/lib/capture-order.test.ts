import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCheckout, type PayPalOrder, type StoredCheckout } from './capture-order';
const local: StoredCheckout = { id: 'order-1', paypal_order_id: 'PAYPAL123', shipping: { total: 1450 } };
function order(status = 'APPROVED'): PayPalOrder {
  return { id: local.paypal_order_id, status, purchase_units: [{ custom_id: local.id, amount: { currency_code: 'GBP', value: '14.50' }, shipping: { address: { country_code: 'GB' } }, ...(status === 'COMPLETED' ? { payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED', amount: { currency_code: 'GBP', value: '14.50' } }] } } : {}) }] };
}
test('claims inventory before capture and reuses the stored order ID for provider idempotency', async () => {
  const events: string[] = [];
  const result = await captureCheckout(local, { getOrder: async () => order(), claim: async () => { events.push('claim'); return { state: 'claimed' }; }, capture: async id => { events.push(id); return order('COMPLETED'); }, settle: async () => { events.push('settle'); return {}; } });
  assert.equal(result.success, true); assert.deepEqual(events, ['claim', 'order-1', 'settle']);
});
test('an expired reservation blocks all payment calls', async () => {
  let captured = false;
  await assert.rejects(captureCheckout(local, { getOrder: async () => order(), claim: async () => { throw new Error('expired'); }, capture: async () => { captured = true; return order(); }, settle: async () => ({}) }), /expired/);
  assert.equal(captured, false);
});
test('duplicate callback does not capture again when provider already completed', async () => {
  let captured = false;
  const result = await captureCheckout(local, { getOrder: async () => order('COMPLETED'), claim: async () => { throw new Error('must not claim'); }, capture: async () => { captured = true; return order(); }, settle: async () => ({}) });
  assert.equal(result.success, true); assert.equal(captured, false);
});
test('lost capture response recovers by reading provider state', async () => {
  let reads = 0;
  const result = await captureCheckout(local, { getOrder: async () => order(++reads === 1 ? 'APPROVED' : 'COMPLETED'), claim: async () => ({ state: 'claimed' }), capture: async () => { throw new Error('timeout'); }, settle: async () => ({}) });
  assert.equal(result.success, true); assert.equal(reads, 2);
});
test('unknown result stays pending and does not settle or release stock', async () => {
  const result = await captureCheckout(local, { getOrder: async () => order(), claim: async () => ({ state: 'claimed' }), capture: async () => { throw new Error('timeout'); }, settle: async () => { throw new Error('must not settle'); } });
  assert.equal(result.pending, true); assert.equal(result.success, undefined); assert.equal(result.paid, undefined);
});
test('storage failure after capture is reported as paid and pending, not payment failure', async () => {
  const result = await captureCheckout(local, { getOrder: async () => order('COMPLETED'), claim: async () => ({ state: 'claimed' }), capture: async () => order(), settle: async () => { throw new Error('database unavailable'); } });
  assert.equal(result.paid, true); assert.equal(result.pending, true);
});
test('wrong amount or country is rejected before inventory claim or capture', async () => {
  for (const change of ['amount', 'country']) {
    const remote = order();
    if (change === 'amount') remote.purchase_units![0].amount!.value = '0.01'; else remote.purchase_units![0].shipping!.address!.country_code = 'US';
    await assert.rejects(captureCheckout(local, { getOrder: async () => remote, claim: async () => { throw new Error('must not claim'); }, capture: async () => remote, settle: async () => ({}) }), /do not match/);
  }
});
test('parallel callback with an active claim stays pending', async () => {
  const result = await captureCheckout(local, { getOrder: async () => order(), claim: async () => ({ state: 'processing' }), capture: async () => { throw new Error('must not capture'); }, settle: async () => ({}) });
  assert.equal(result.pending, true);
});
