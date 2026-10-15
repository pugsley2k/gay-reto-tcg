import { NextRequest, NextResponse } from 'next/server';
import { syncCarrierTracking } from '@/lib/royal-mail';
import { flushEmails } from '@/lib/email-outbox';
export const dynamic = 'force-dynamic';
export const maxDuration=60;
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let postage;try{postage=await syncCarrierTracking();}catch{postage={error:'Tracking sync failed; retry in Seller Studio.'};}return NextResponse.json({postage,...await flushEmails()});
}
