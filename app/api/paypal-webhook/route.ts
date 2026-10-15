import { NextRequest } from 'next/server';
import { completePaidOrder } from '@/lib/paid-order';
export async function POST(req: NextRequest) {
  try {
    const names = ['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];
    if (names.some(name => !req.headers.get(name))) return new Response('Missing verification headers', { status: 400 });
    const event = await req.json();
    const base = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
    const authRes = await fetch(`${base}/v1/oauth2/token`, { method:'POST', headers:{ Authorization:'Basic '+Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64'), 'Content-Type':'application/x-www-form-urlencoded' }, body:'grant_type=client_credentials' });
    if (!authRes.ok) throw new Error('PayPal authentication failed.');
    const { access_token } = await authRes.json();
    const verifiedRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, { method:'POST', headers:{ Authorization:`Bearer ${access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ auth_algo:req.headers.get(names[0]),cert_url:req.headers.get(names[1]),transmission_id:req.headers.get(names[2]),transmission_sig:req.headers.get(names[3]),transmission_time:req.headers.get(names[4]),webhook_id:process.env.PAYPAL_WEBHOOK_ID,webhook_event:event }) });
    if (!verifiedRes.ok || (await verifiedRes.json()).verification_status !== 'SUCCESS') return new Response('Verification failed', { status:400 });
    // Approval is not proof of payment. Only captured/completed events finalise orders.
    if (['PAYMENT.CAPTURE.COMPLETED','CHECKOUT.ORDER.COMPLETED'].includes(event.event_type)) {
      const paypalId = event.event_type === 'PAYMENT.CAPTURE.COMPLETED' ? event.resource?.supplementary_data?.related_ids?.order_id : event.resource?.id;
      if (typeof paypalId !== 'string' || !/^[A-Z0-9]+$/i.test(paypalId)) return new Response('Missing payment reference', { status:400 });
      const orderRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(paypalId)}`, { headers:{ Authorization:`Bearer ${access_token}` } });
      if (!orderRes.ok) throw new Error('Could not verify completed payment.');
      const result = await completePaidOrder(await orderRes.json());
      if (result.failed) return new Response('Email queued for retry', { status:503 });
    }
    return new Response('Webhook received');
  } catch { return new Response('Order processing pending retry', { status:500 }); }
}
