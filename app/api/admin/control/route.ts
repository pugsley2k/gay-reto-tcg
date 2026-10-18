import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/admin';
import { serverDb } from '@/lib/server-db';
import { runStoreChecks } from '@/lib/agent-control';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const db = serverDb();
  const [settings, runs, actions, cards, events] = await Promise.all([
    db.from('agent_settings').select('paused,spend_limit_pence,updated_at').eq('id', true).single(),
    db.from('agent_runs').select('id,trigger_source,status,started_at,finished_at,summary,error').order('started_at', { ascending: false }).limit(15),
    db.from('agent_actions').select('id,kind,title,detail,severity,card_id,order_id,state,created_at,expires_at,decided_at,outcome').eq('state','pending').order('created_at', { ascending: false }).limit(100),
    db.from('Card').select('id,name,price').eq('available', true).is('sold_at', null).neq('id','demo-gardevoir-ex').order('name').limit(100),
    db.from('agent_events').select('id,created_at,title,detail').order('created_at',{ascending:false}).limit(20),
  ]);
  if (settings.error || runs.error || actions.error || cards.error || events.error) return NextResponse.json({ error: 'Control centre storage is not ready. Its database migration must be installed before checks can run.' }, { status: 503 });
  return NextResponse.json({ settings: settings.data, runs: runs.data, actions: actions.data, cards: cards.data, events:events.data, scheduled: !!process.env.CRON_SECRET }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (user?.publicMetadata.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = await req.json(); const db = serverDb();
    if (body.action === 'run') return NextResponse.json(await runStoreChecks('manual'));
    if (body.action === 'pause' && typeof body.paused === 'boolean') {
      const result = await db.from('agent_settings').update({ paused: body.paused, updated_at: new Date().toISOString() }).eq('id', true);
      if (result.error) throw new Error('Could not save the pause setting.');
      await db.from('agent_events').insert({actor_id:user.id,title:body.paused?'Routine checks paused':'Routine checks resumed',detail:'Changed by the owner. Checkout payment protection remains active.'});
      return NextResponse.json({ message: body.paused ? 'Routine checks paused.' : 'Routine checks resumed.' });
    }
    if (body.action === 'decide' && typeof body.id === 'string' && /^[a-f0-9]{64}$/.test(body.id) && ['approve','dismiss'].includes(body.decision)) {
      const result = await db.rpc('decide_agent_action', { p_id: body.id, p_decision: body.decision, p_actor: user.id });
      if (result.error) throw new Error(/reserved|manual review/.test(result.error.message) ? result.error.message : 'Could not apply this decision. Refresh and try again.');
      return NextResponse.json({ state: result.data, message: result.data === 'executed' ? 'Listing hidden. The action is recorded below.' : result.data === 'stale' ? 'The listing changed or approval expired. Run checks again.' : 'Decision saved.' });
    }
    return NextResponse.json({ error: 'This action is not enabled. Paid actions are disabled.' }, { status: 400 });
  } catch(error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not complete this action.' }, { status: 503 }); }
}
