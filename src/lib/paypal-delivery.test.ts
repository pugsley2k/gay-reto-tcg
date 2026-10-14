import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextApiRequest, NextApiResponse } from 'next';
import capture from '../../pages/api/paypal-capture';

for (const country of ['GB', 'US', undefined]) {
  test(`capture checks delivery country ${country ?? 'missing'} before charging`, async context => {
    const calls: string[] = [];
    context.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
      const address = String(url);
      calls.push(address);
      if (address.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-token' });
      if (address.endsWith('/capture')) return Response.json({ status: 'COMPLETED' });
      return Response.json({ purchase_units: [{ shipping: { address: { country_code: country } } }] });
    });
    let status = 0;
    const response = { status(code: number) { status = code; return this; }, json() { return this; } };
    await capture({ query: { token: 'TEST-ORDER' } } as unknown as NextApiRequest, response as unknown as NextApiResponse);
    assert.equal(status, country === 'GB' ? 200 : 400);
    assert.equal(calls.some(url => url.endsWith('/capture')), country === 'GB');
    assert.equal(calls.filter(url => url.includes('/v2/checkout/orders/TEST-ORDER')).length, country === 'GB' ? 2 : 1);
  });
}
