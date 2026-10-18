import { NextRequest, NextResponse } from 'next/server';
import { syncCarrierTracking } from '@/lib/royal-mail';
import { flushEmails } from '@/lib/email-outbox';
import { serverDb } from '@/lib/server-db';
import { runStoreChecks } from '@/lib/agent-control';
export const dynamic = 'force-dynamic';
export const maxDuration=60;
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await serverDb().rpc('expire_checkouts');
  const [checks, fulfilment] = await Promise.all([
    runStoreChecks('daily').catch(() => ({ error: 'Store checks failed; open the control centre.' })),
    (async () => {
      const postage = await syncCarrierTracking().catch(() => ({ error: 'Tracking sync failed; retry in Seller Studio.' }));
      // Tracking sync queues emails; flush only after it finishes.
      return { postage, ...await flushEmails() };
    })(),
  ]);
  return NextResponse.json({checks,...fulfilment});
}
