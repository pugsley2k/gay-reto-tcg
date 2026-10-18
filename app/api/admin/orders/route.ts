import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { serverDb } from '@/lib/server-db';
import { orderEmail, validTracking } from '@/lib/order-email';
import { flushEmails } from '@/lib/email-outbox';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const { data, error } = await serverDb().from('orders').select('id,status,items,created_at,shipping,paid_at,customer_email,tracking_number,dispatched_at,carrier_order_id,carrier_cost_pence,payment_fee_pence,order_emails(id,kind,sent_at,last_error)').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Could not load orders.' }, { status: 503 });
  return NextResponse.json({ orders: data, emailConfigured: !!process.env.RESEND_API_KEY }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = await req.json();
    if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id)) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
    const db = serverDb();
    const { data: order, error } = await db.from('orders').select('*').eq('id', body.id).single();
    if (error || !order?.paid_at || !order.customer_email) return NextResponse.json({ error: 'Only captured orders with a customer email can be dispatched.' }, { status: 400 });
    if (order.checkout_state === 'payment_review') return NextResponse.json({ error: 'Resolve the payment and stock review before dispatching or sending emails for this order.' }, { status: 409 });
    if(body.action==='costs'){const values=[body.carrier_cost_pence,body.payment_fee_pence];if(values.some(value=>value!==null&&(!Number.isInteger(value)||value<0||value>10000000)))return NextResponse.json({error:'Invalid actual costs.'},{status:400});const saved=await db.from('orders').update({carrier_cost_pence:body.carrier_cost_pence,payment_fee_pence:body.payment_fee_pence}).eq('id',order.id);if(saved.error)throw new Error('Could not save actual costs.');return NextResponse.json({message:'Actual costs saved.'});}
    if (body.action === 'dispatch') {
      const tracking = typeof body.tracking === 'string' ? body.tracking.trim().toUpperCase() : '';
      if (!validTracking(tracking)) return NextResponse.json({ error: 'Enter a Royal Mail tracking reference (8–30 letters/numbers).' }, { status: 400 });
      if (order.tracking_number && order.tracking_number !== tracking) return NextResponse.json({ error: 'Tracking has already been recorded. Email the customer if it needs correcting.' }, { status: 409 });
      const { error: queued } = await db.rpc('dispatch_order', { p_id: order.id, p_tracking: tracking, p_message: orderEmail({ ...order, tracking }, 'tracking') });
      if (queued) throw new Error('Tracking and its email could not be saved. Refresh and retry.');
    } else if (body.action !== 'retry') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    const result = await flushEmails(order.id);
    return NextResponse.json({ message: result.failed ? 'Saved. Email is pending; you can retry it here.' : 'Email accepted by the sending service.' });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update order.' }, { status: 503 }); }
}
