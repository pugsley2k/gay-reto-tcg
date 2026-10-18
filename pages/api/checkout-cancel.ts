import type { NextApiRequest, NextApiResponse } from 'next';
import { checkoutOrigin, checkoutSession, isCheckoutId } from '../../src/lib/checkout-session';
import { serverDb } from '../../src/lib/server-db';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  try { checkoutOrigin(req); } catch { return res.status(403).end(); }
  const session = checkoutSession(req);
  if (!session || !isCheckoutId(req.body?.id)) return res.status(400).json({ error: 'Invalid checkout.' });
  const result = await serverDb().rpc('cancel_checkout', { p_id: req.body.id, p_session_hash: session });
  if (result.error || !result.data) return res.status(409).json({ error: 'This checkout could not be cancelled. If you approved payment, check its status before paying again.' });
  return res.json({ cancelled: true });
}
