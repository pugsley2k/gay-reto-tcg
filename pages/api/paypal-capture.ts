import type { NextApiRequest, NextApiResponse } from 'next';
import { isUKShippingOrder } from '../../src/lib/shipping';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET!;
const BASE_URL = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const auth = await getPayPalAccessToken();
    const orderRes = await fetch(`${BASE_URL}/v2/checkout/orders/${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    if (!orderRes.ok) return res.status(502).json({ error: 'Could not verify the delivery address. Please contact gayretrotcg@gmail.com.' });
    const order = await orderRes.json();
    if (!isUKShippingOrder(order)) return res.status(400).json({ error: 'We currently deliver to UK addresses only. Payment has not been captured. Return to your cart and choose a UK delivery address in PayPal.' });

    const captureRes = await fetch(`${BASE_URL}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      console.error("❌ Capture failed:", captureData);
      return res.status(500).json({ error: 'Failed to capture payment', captureData });
    }

    console.log("✅ Payment captured!", JSON.stringify(captureData, null, 2));
    return res.status(200).json({ success: true, captureData });
  } catch (err: any) {
    console.error("🔥 Capture error:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function getPayPalAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("No access token");
  return data.access_token;
}
