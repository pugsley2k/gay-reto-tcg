import type { NextApiRequest, NextApiResponse } from 'next';
import { checkoutOrigin, checkoutSession } from '../../src/lib/checkout-session';
import { captureCheckout } from '../../src/lib/capture-order';
import { paypalAccessToken, paypalRequest } from '../../src/lib/paypal';
import { completePaidOrder } from '../../src/lib/paid-order';
import { serverDb } from '../../src/lib/server-db';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST to complete checkout.' }); }
  try { checkoutOrigin(req); } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[A-Z0-9]{8,40}$/.test(token)) return res.status(400).json({ error: 'Invalid PayPal order.' });
  try {
    const db = serverDb();
    const { data: local, error } = await db.from('orders').select('*').eq('paypal_order_id', token).single();
    if (error || !local) return res.status(404).json({ error: 'Order not found. Please contact the shop before paying again.' });
    const session = checkoutSession(req);
    if (local.checkout_session_hash && local.checkout_session_hash !== session) return res.status(403).json({ error: 'Return to the browser where you started checkout.' });
    const access = await paypalAccessToken();
    const result = await captureCheckout(local, {
      getOrder: async () => { const r = await paypalRequest(`/v2/checkout/orders/${token}`, access); if (!r.ok) throw new Error('Could not check PayPal. Please retry this page; do not start another checkout.'); return r.json(); },
      claim: async () => { const r = await db.rpc('begin_checkout_capture', { p_paypal_id: token, p_session_hash: session }); if (r.error) throw new Error(r.error.message); return r.data; },
      capture: async id => { const r = await paypalRequest(`/v2/checkout/orders/${token}/capture`, access, {}, id); if (!r.ok) throw new Error('Capture result unavailable.'); return r.json(); },
      settle: completePaidOrder,
    });
    return res.status(result.pending ? 202 : 200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = /expired|no longer available|reserved|not been taken|not been requested|Could not check PayPal/.test(message);
    return res.status(409).json({ error: safe ? message : 'We could not confirm your payment. Please contact gayretrotcg@gmail.com before paying again.' });
  }
}
