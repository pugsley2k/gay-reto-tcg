// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serverDb } from '../../src/lib/server-db';
import { v4 as uuidv4 } from 'uuid';
import { validateCheckout, priceCheckout } from '../../src/lib/checkout';
import { requireShipping, type ShippingQuote } from '../../src/lib/shipping';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET!;
const BASE_URL = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com"; // Live PayPal URL


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { lineItems } = req.body;
  const supabase = serverDb();

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty lineItems provided.' });
  }

  let totalAmount: number;
  let shipping: ShippingQuote;
  let cardSummary: { id: string; name: string; quantity: number }[];
  try {
    const ids = validateCheckout(lineItems);
    const { data, error } = await supabase.from('Card').select('id,name,price,available').in('id', ids);
    if (error) return res.status(503).json({ error: 'Could not check inventory. Please try again.' });
    const priced = priceCheckout(ids, data ?? []);
    totalAmount = priced.total;
    const {data:costs,error:costError}=await supabase.from('card_economics').select('card_id,cost_pence').in('card_id',ids);
    if(costError)throw new Error('Could not prepare order details. Please try again.');
    cardSummary = priced.summary.map(item=>({...item,cost_pence:costs?.find(cost=>cost.card_id===item.id)?.cost_pence??null}));
    shipping = requireShipping(totalAmount, ids.length, req.body.shippingMethod);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid cart.' });
  }

  // 🔥 Generate orderId
  const orderId = uuidv4();

  // 💾 Store order in Supabase
  const { error: insertError } = await supabase.from("orders").insert({
    id: orderId,
    items: cardSummary,
    status: "pending",
    shipping: { ...shipping, country: 'GB', subtotal: totalAmount, total: totalAmount + shipping.price },
  });

  if (insertError) {
    console.error("❌ Supabase insert failed. Full response:", insertError, JSON.stringify(insertError, null, 2));

    return res.status(500).json({ error: 'Failed to store order data' });
  }

  try {
    const auth = await getPayPalAccessToken();

    const orderRes = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "GBP",
            value: ((totalAmount + shipping.price) / 100).toFixed(2),
            breakdown: {
              item_total: { currency_code: 'GBP', value: (totalAmount / 100).toFixed(2) },
              shipping: { currency_code: 'GBP', value: (shipping.price / 100).toFixed(2) },
            },
          },
          description: shipping.label,
          custom_id: orderId, // 💡 Short ID used to link to DB
        }],
        application_context: {
          shipping_preference: 'GET_FROM_FILE',
          return_url: `${req.headers.origin}/success`,
          cancel_url: `${req.headers.origin}/cart`,
        },
      }),
    });

    const orderData = await orderRes.json();

    if (!orderData || !orderData.links) {
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }

    const approvalLink = orderData.links.find((link: any) => link.rel === 'approve')?.href;
    if (!approvalLink) {
      return res.status(500).json({ error: 'Approval URL not found in PayPal response' });
    }
    const { error: linked } = await supabase.from('orders').update({ paypal_order_id: orderData.id }).eq('id', orderId);
    if (linked) return res.status(503).json({ error: 'Could not link your payment. Please try again.' });

    return res.status(200).json({ url: approvalLink });

  } catch (err: any) {
    console.error("PayPal Checkout Error:", err);
    return res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
}

async function getPayPalAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const text = await response.text(); // capture raw text first for debugging
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("PayPal token response not JSON:", text);
    throw new Error("PayPal token response was not valid JSON");
  }

  if (!response.ok) {
    console.error("PayPal token fetch failed:", response.status, data);
    throw new Error(data.error_description || "Failed to obtain PayPal access token");
  }

  if (!data.access_token) {
    console.error("No access_token in response:", data);
    throw new Error("PayPal token response missing access_token");
  }

  return data.access_token;
}
