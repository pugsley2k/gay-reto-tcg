import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import capture from '../../pages/api/paypal-capture';

for (const country of ['GB', 'US', undefined]) {
  test(`capture checks delivery country ${country ?? 'missing'} before charging`, async context => {
    const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.com';
    process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
    context.after(() => {
      if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
      if (previous.key === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previous.key;
    });
    const calls: string[] = [];
    const cookie = 'a'.repeat(64);
    const local = { id: 'd870ad10-7d62-4b98-8040-d86b3ab05f71', paypal_order_id: 'TESTORDER123', checkout_state: 'reserved', checkout_session_hash: createHash('sha256').update(cookie).digest('hex'), items: [{ id: 'card', name: 'Mew', price: 1000, quantity: 1 }], shipping: { total: 1450, subtotal: 1000, price: 450, label: 'Tracked 48' } };
    const unit = { custom_id: local.id, amount: { currency_code: 'GBP', value: '14.50' }, shipping: { address: { country_code: country } } };
    context.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
      const address = String(url);
      calls.push(address);
      if (address.includes('/rest/v1/orders')) return Response.json(local);
      if (address.includes('/rpc/begin_checkout_capture')) return Response.json({ state: 'claimed' });
      if (address.includes('/rpc/settle_checkout_payment')) return Response.json('completed');
      if (address.includes('/rest/v1/order_emails')) return Response.json([]);
      if (address.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-token' });
      if (address.endsWith('/capture')) return Response.json({ id: local.paypal_order_id, status: 'COMPLETED', payer: { email_address: 'test@example.test' }, purchase_units: [{ ...unit, payments: { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: unit.amount }] } }] });
      return Response.json({ id: local.paypal_order_id, status: 'APPROVED', purchase_units: [unit] });
    });
    let status = 0;
    let body: any;
    const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: any) { body = value; return this; } };
    await capture({ method: 'POST', body: { token: local.paypal_order_id }, cookies: { grt_checkout: cookie }, headers: { origin: 'https://www.gayretrotcg.com' } } as any, response as any);
    assert.equal(status, country === 'GB' ? 200 : 409);
    assert.equal(body.success === true, country === 'GB');
    assert.equal(calls.some(url => url.endsWith('/capture')), country === 'GB');
    assert.equal(calls.some(url => url.includes('/rpc/begin_checkout_capture')), country === 'GB');
  });
}

test('GET callbacks and cross-origin requests cannot capture a payment', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call any provider'); });
  for (const [method, origin, expected] of [['GET', 'https://www.gayretrotcg.com', 405], ['POST', 'https://untrusted.example', 403]] as const) {
    let status = 0;
    const response = { setHeader() {}, status(code: number) { status = code; return this; }, json() { return this; } };
    await capture({ method, headers: { origin }, body: { token: 'TESTORDER123' } } as any, response as any);
    assert.equal(status, expected);
  }
});
