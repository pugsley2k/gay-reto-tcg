import type { NextApiRequest, NextApiResponse } from 'next';
import { serverDb } from '../../src/lib/server-db';
import { validateCheckout, priceCheckout } from '../../src/lib/checkout';
import { requireShipping } from '../../src/lib/shipping';
import { promoDiscount } from '../../src/lib/promo';
import { checkoutOrigin, checkoutSession, isCheckoutId } from '../../src/lib/checkout-session';
import { paypalAccessToken, paypalRequest } from '../../src/lib/paypal';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  let origin: string;
  try { origin = checkoutOrigin(req); } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
  const { lineItems, requestId, shippingMethod, promoCode } = req.body || {};
  if (!isCheckoutId(requestId)) return res.status(400).json({ error: 'Refresh your cart before checking out.' });
  const session = checkoutSession(req, res);
  const db = serverDb();
  let order;
  try {
    const ids = validateCheckout(lineItems);
    const [stock, costs] = await Promise.all([db.from('Card').select('id,name,price,available').in('id', ids), db.from('card_economics').select('card_id,cost_pence').in('card_id', ids)]);
    if (stock.error || costs.error) throw new Error('Could not check inventory. Please try again.');
    const priced = priceCheckout(ids, stock.data || []);
    const discount = promoDiscount(priced.total, promoCode);
    const shipping = requireShipping(priced.total, ids.length, shippingMethod);
    const reserved = await db.rpc('reserve_checkout', {
      p_id: requestId, p_session_hash: session,
      p_items: priced.summary.map(item => ({ ...item, cost_pence: costs.data?.find(cost => cost.card_id === item.id)?.cost_pence ?? null })),
      p_shipping: { ...shipping, country: 'GB', subtotal: priced.total, discount: discount.amount, promo_code: discount.code, total: priced.total - discount.amount + shipping.price },
    });
    if (reserved.error) {
      const message = reserved.error.message;
      const safe = /temporarily reserved|no longer available|prices changed|expired|details changed/.test(message);
      return res.status(409).json({ error: safe ? message : 'Could not reserve these cards. Refresh your cart and try again.', resetCheckout: /expired|details changed/.test(message) });
    }
    order = reserved.data;
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Check your cart and try again.', resetCheckout: true }); }
  try {
    const access = await paypalAccessToken();
    const response = order.paypal_order_id
      ? await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.paypal_order_id)}`, access)
      : await paypalRequest('/v2/checkout/orders', access, {
        intent: 'CAPTURE', purchase_units: [{ custom_id: order.id, description: order.shipping.label,
          amount: { currency_code: 'GBP', value: (order.shipping.total / 100).toFixed(2), breakdown: {
            item_total: { currency_code: 'GBP', value: (order.shipping.subtotal / 100).toFixed(2) }, shipping: { currency_code: 'GBP', value: (order.shipping.price / 100).toFixed(2) },
            ...(order.shipping.discount ? { discount: { currency_code: 'GBP', value: (order.shipping.discount / 100).toFixed(2) } } : {}),
          } },
        }], application_context: { shipping_preference: 'GET_FROM_FILE', return_url: `${origin}/success`, cancel_url: `${origin}/cart?cancel_checkout=${order.id}` },
      }, order.id);
    if (!response.ok) throw new Error('PayPal is still preparing checkout.');
    const remote = await response.json();
    const url = remote.links?.find((link: { rel: string }) => link.rel === 'approve')?.href;
    if (typeof remote.id !== 'string' || typeof url !== 'string' || !/^https:\/\/([a-z0-9-]+\.)?paypal\.com\//i.test(url)) throw new Error('PayPal did not provide a checkout link.');
    const linked = await db.from('orders').update({ paypal_order_id: remote.id }).eq('id', order.id).eq('checkout_state', 'reserved').select('id').maybeSingle();
    if (linked.error || !linked.data) throw new Error('Checkout could not be linked.');
    return res.status(200).json({ url, expiresAt: order.reservation_expires_at });
  } catch { return res.status(503).json({ error: 'Checkout could not finish starting. Retry here; your cards are held for up to 15 minutes.' }); }
}
