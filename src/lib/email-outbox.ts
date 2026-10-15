import { Resend } from 'resend';
import { randomUUID } from 'node:crypto';
import { serverDb } from './server-db';

export async function sendQueuedEmail(id: string) {
  const db = serverDb();
  const now = new Date().toISOString();
  const lease = randomUUID();
  const { data: row, error } = await db.from('order_emails').update({ lease_id: lease, locked_until: new Date(Date.now() + 120000).toISOString() }).eq('id', id).is('sent_at', null).or(`locked_until.is.null,locked_until.lt.${now}`).select('*').maybeSingle();
  if (error) throw new Error('Could not claim email.');
  if (!row) return;
  try {
    if (row.first_attempt_at && Date.now() - new Date(row.first_attempt_at).getTime() > 23 * 3600000) throw new Error('Manual review needed: check Resend logs before resending this older message.');
    if (!process.env.RESEND_API_KEY) throw new Error('Email service is not configured.');
    const { error: attempted } = await db.from('order_emails').update({ first_attempt_at: row.first_attempt_at || now }).eq('id', id).eq('lease_id', lease);
    if (attempted) throw new Error('Could not record email attempt.');
    const { data, error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `Gay Retro TCG <orders@${process.env.RESEND_EMAIL_DOMAIN || 'gayretrotcg.com'}>`,
      replyTo: 'gayretrotcg@gmail.com', to: row.recipient, ...row.message,
    }, { idempotencyKey: row.id });
    if (sendError || !data?.id) throw new Error('Email provider could not accept this message.');
    const { error: saved } = await db.from('order_emails').update({ sent_at: new Date().toISOString(), provider_id: data.id, last_error: null, locked_until: null }).eq('id', id).eq('lease_id', lease);
    if (saved) throw new Error('Email accepted; could not save delivery status.');
  } catch (error) {
    await db.from('order_emails').update({ last_error: error instanceof Error ? error.message : 'Email failed.', locked_until: null }).eq('id', id).eq('lease_id', lease);
    throw error;
  }
}
export async function flushEmails(orderId?: string) {
  let query = serverDb().from('order_emails').select('id').is('sent_at', null).order('created_at').limit(10);
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) throw new Error('Could not load pending emails.');
  let failed = 0;
  for (const row of data || []) {
    try { await sendQueuedEmail(row.id); } catch { failed++; }
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  return { processed: data?.length || 0, failed };
}
