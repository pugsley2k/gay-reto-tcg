import { NextRequest, NextResponse } from 'next/server';
import { flushEmails } from '@/lib/email-outbox';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await flushEmails());
}
