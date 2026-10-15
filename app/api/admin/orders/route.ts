import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { serverDb } from '@/lib/server-db';
import { orderEmail, validTracking } from '@/lib/order-email';
import { flushEmails } from '@/lib/email-outbox';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const { data, error } = await serverDb().from('orders').select('id,status,items,created_at,shipping,paid_at,customer_email,tracking_number,dispatched_at,order_emails(id,kind,sent_at,last_error)').order('created_at', { ascending: false }).limit(100);
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
    if (body.action === 'dispatch') {
      const tracking = typeof body.tracking === 'string' ? body.tracking.trim().toUpperCase() : '';
      if (!validTracking(tracking)) return NextResponse.json({ error: 'Enter a Royal Mail tracking reference (8–30 letters/numbers).' }, { status: 400 });
      if (order.tracking_number && order.tracking_number !== tracking) return NextResponse.json({ error: 'Tracking has already been recorded. Email the customer if it needs correcting.' }, { status: 409 });
      const { data: updated, error: saved } = await db.from('orders').update({ tracking_number: tracking, dispatched_at: order.dispatched_at || new Date().toISOString() }).eq('id', order.id).or(`tracking_number.is.null,tracking_number.eq.${tracking}`).select('id').maybeSingle();
      if (saved || !updated) return NextResponse.json({ error: 'Could not save tracking. Refresh and try again.' }, { status: 409 });
      const { error: queued } = await db.from('order_emails').upsert({ id: `${order.id}-tracking-${tracking}`, order_id: order.id, kind: 'tracking', recipient: order.customer_email, message: orderEmail({ ...order, tracking }, 'tracking') }, { onConflict: 'id', ignoreDuplicates: true });
      if (queued) throw new Error('Tracking saved, but the email could not be queued. Retry the same tracking reference.');
    } else if (body.action !== 'retry') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    const result = await flushEmails(order.id);
    return NextResponse.json({ message: result.failed ? 'Saved. Email is pending; you can retry it here.' : 'Email accepted by the sending service.' });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update order.' }, { status: 503 }); }
}
