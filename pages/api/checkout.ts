// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET!;
const BASE_URL = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com"; // Live PayPal URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { lineItems } = req.body;

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty lineItems provided.' });
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
  const cardSummary = lineItems.map(item => ({
  id: item.cardId,
  name: item.price_data.product_data.name,
  quantity: item.quantity
}));

const cardSummaryJson = JSON.stringify(cardSummary).slice(0, 127); // PayPal custom_id max = 127 chars


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
            value: (totalAmount / 100).toFixed(2),
          },
          custom_id: cardSummaryJson,

        }],
        application_context: {
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
