import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { isAdmin } from '@/lib/admin';
import { orderEmail } from '@/lib/order-email';
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Resend is not configured.' }, { status: 503 });
  const message = orderEmail({ id: 'SETUP-TEST', items: [{ name: 'Example card — setup test only', quantity: 1, price: 1000 }], shipping: { label: 'Royal Mail Tracked 48', subtotal: 1000, price: 450, total: 1450 } }, 'confirmation');
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: `Gay Retro TCG <orders@${process.env.RESEND_EMAIL_DOMAIN || 'gayretrotcg.com'}>`, to: 'gayretrotcg@gmail.com', replyTo: 'gayretrotcg@gmail.com', subject: 'TEST — Gay Retro TCG email setup', html: '<p>SETUP TEST ONLY — no order was placed and no payment was taken.</p>' + message.html, text: 'SETUP TEST ONLY — no order was placed and no payment was taken.\n\n' + message.text }, { idempotencyKey: 'gayretro-email-setup-20261015' });
  return error ? NextResponse.json({ error: 'The email provider rejected the setup test. Check domain verification.' }, { status: 503 }) : NextResponse.json({ message: 'Setup test accepted for delivery to gayretrotcg@gmail.com.', id: data?.id });
}
