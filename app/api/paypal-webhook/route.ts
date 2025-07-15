// app/api/paypal-webhook/route.ts
import { NextRequest } from 'next/server';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const requiredHeaders = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ];

    const missing = requiredHeaders.filter(h => !req.headers.get(h));
    if (missing.length) {
      console.error("❌ Missing required PayPal headers:", missing);
      return new Response('Missing required PayPal headers', { status: 400 });
    }

    const rawBody = await req.arrayBuffer();
    const bodyBuffer = Buffer.from(rawBody);
    const event = JSON.parse(bodyBuffer.toString());

    const webhookId = process.env.PAYPAL_WEBHOOK_ID!;
    const authAlgo = req.headers.get('paypal-auth-algo')!;
    const certUrl = req.headers.get('paypal-cert-url')!;
    const transmissionId = req.headers.get('paypal-transmission-id')!;
    const transmissionSig = req.headers.get('paypal-transmission-sig')!;
    const transmissionTime = req.headers.get('paypal-transmission-time')!;

    const accessTokenRes = await fetch(`${process.env.PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const { access_token } = await accessTokenRes.json();

    const verificationRes = await fetch(`${process.env.PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });

    const verification = await verificationRes.json();
    if (verification.verification_status !== 'SUCCESS') {
      console.error("❌ Failed PayPal webhook verification:", verification);
      return new Response('Webhook verification failed', { status: 400 });
    }

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const purchaseUnits = event.resource?.purchase_units;
      const orderId = purchaseUnits?.[0]?.custom_id;

      if (!orderId) {
        console.warn("⚠️ custom_id (orderId) missing in PayPal webhook:", JSON.stringify(event, null, 2));
        return new Response('Missing custom_id (orderId)', { status: 400 });
      }

      // 🧾 Fetch order from Supabase
      const { data: order, error: fetchError } = await supabase
        .from("Orders")
        .select("items")
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        console.error("❌ Failed to retrieve order from Supabase:", fetchError);
        return new Response('Order not found', { status: 404 });
      }

      let cards;

try {
  cards = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
} catch (err) {
  console.error("❌ Failed to parse order.items:", order.items, err);
  return new Response('Invalid order items format', { status: 500 });
}


      for (const { id, name, quantity } of cards) {
        const { error } = await supabase
          .from("Card")
          .update({ available: false })
          .eq("id", id);

        if (error) {
          console.error(`❌ Failed to update card ${id} (${name})`, error);
        } else {
          console.log(`✅ Marked card "${id}" (${name}) as unavailable`);

        }
      }

      // ✅ Optional: mark order as complete
      await supabase
        .from("Orders")
        .update({ status: "completed" })
        .eq("id", orderId);
    }

    return new Response('Webhook received', { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
