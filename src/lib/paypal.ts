const base = () => process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
export async function paypalAccessToken() {
  const response = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error('PayPal is temporarily unavailable.');
  const data = await response.json();
  if (!data.access_token) throw new Error('PayPal is temporarily unavailable.');
  return data.access_token as string;
}
export async function paypalRequest(path: string, access: string, body?: unknown, requestId?: string) {
  return fetch(`${base()}${path}`, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(20000), cache: 'no-store',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
