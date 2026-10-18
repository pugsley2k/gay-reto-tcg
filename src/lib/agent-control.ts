import { serverDb } from './server-db';
import { inspectStore, type CheckCard, type CheckOrder } from './agent-checks';
export async function runStoreChecks(source: 'manual' | 'daily') {
  const db = serverDb();
  const claim = await db.rpc('start_agent_run', { p_source: source });
  if (claim.error) throw new Error('Control centre storage is not ready. Apply the control centre migration.');
  if (!claim.data) return { skipped: true, message: 'Checks are paused or another check just ran. Refresh to see the latest result.' };
  const id = claim.data as string;
  try {
    const cards: CheckCard[] = [];
    for (let page = 0; page < 20; page++) {
      const result = await db.from('Card').select('id,name,price,available,image_url,front_image_url,back_image_url,condition,grading,updatedAt,sold_at').order('id').range(page * 500, page * 500 + 499);
      if (result.error) throw new Error('Inventory check could not finish.');
      cards.push(...result.data);
      if (result.data.length < 500) break;
      if (page === 19) throw new Error('Inventory is too large for this check. No findings were automatically resolved.');
    }
    const orders: CheckOrder[] = [];
    for (let page = 0; page < 20; page++) {
      const result = await db.from('orders').select('id,checkout_state,created_at,capture_started_at,paid_at,dispatched_at,payment_issue').is('dispatched_at', null).order('id').range(page * 500, page * 500 + 499);
      if (result.error) throw new Error('Order check could not finish.');
      orders.push(...result.data);
      if (result.data.length < 500) break;
      if (page === 19) throw new Error('Order history needs a larger check window. No findings were automatically resolved.');
    }
    const result = inspectStore(cards, orders);
    const saved = await db.rpc('finish_agent_run', { p_id: id, p_summary: result.summary, p_actions: result.actions });
    if (saved.error) throw new Error('Could not save the check results.');
    return { skipped: false, summary: result.summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Check failed.';
    await db.from('agent_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error: message }).eq('id', id).eq('status', 'running');
    throw error;
  }
}
