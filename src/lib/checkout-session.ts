import { createHash, randomBytes } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
const COOKIE = 'grt_checkout';
export const isCheckoutId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export function checkoutSession(req: NextApiRequest, res?: NextApiResponse) {
  let value = req.cookies[COOKIE];
  if (!value || !/^[a-f0-9]{64}$/.test(value)) {
    if (!res) return null;
    value = randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }
  return createHash('sha256').update(value).digest('hex');
}
export function checkoutOrigin(req: NextApiRequest) {
  const allowed = new Set([new URL(process.env.SITE_URL || 'https://www.gayretrotcg.com').origin, 'https://gayretrotcg.com']);
  if (process.env.NODE_ENV !== 'production') { allowed.add('http://localhost:12010'); allowed.add('http://127.0.0.1:12010'); }
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !allowed.has(origin)) throw new Error('Invalid request origin.');
  return origin;
}
