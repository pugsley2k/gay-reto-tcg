import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
const session = 'a'.repeat(64);
const shipping = { subtotal: 1000, discount: 0, price: 450, total: 1450, country: 'GB' };
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public."Card" (id text primary key,name text,price integer,available boolean default true,"createdAt" timestamp default now(),"updatedAt" timestamp default now(),image_url text,condition text,edition text,holo_type text);
    create table public.orders(id uuid primary key,items jsonb not null,status text default 'pending',created_at timestamptz default now(),shipping jsonb);
    create table public.rarities(code text); create table public.finishes(code text); create table public.setnames(code text); create table public._prisma_migrations(id text);
    grant usage on schema public to anon,authenticated,service_role;
    grant all on public."Card" to anon,authenticated,service_role;`);
  for (const name of readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => /20261015000000_order_emails|20261015000001_dispatch_order|20261015000002_collection_tools|20261015000003_dispatch_tools|checkout_reservations|agent_control_centre|seo_maintenance_agents/.test(name)).sort()) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
});
after(() => db.close());
async function card() { const id = randomUUID(); await db.query('insert into public."Card"(id,name,price) values($1,$2,1000)', [id, 'Test card']); return id; }
async function reserve(cardId, id = randomUUID(), hash = session) {
  const items = [{ id: cardId, name: 'Test card', price: 1000, quantity: 1, cost_pence: null }];
  const result = await db.query('select public.reserve_checkout($1,$2,$3,$4) as result', [id, JSON.stringify(items), JSON.stringify(shipping), hash]);
  return result.rows[0].result;
}
async function claim(o) {
  await db.query('update public.orders set paypal_order_id=$2 where id=$1', [o.id, o.id]);
  return (await db.query('select public.begin_checkout_capture($1,$2) as result', [o.id, session])).rows[0].result;
}
test('competing orders cannot reserve the same physical card; same request is idempotent', async () => {
  const item = await card(); const o = await reserve(item);
  await assert.rejects(reserve(item), /temporarily reserved/);
  assert.equal((await reserve(item, o.id)).id, o.id);
  await assert.rejects(reserve(item, o.id, 'b'.repeat(64)), /another session/);
});
test('expired holds can be reclaimed, and old checkout cannot capture', async () => {
  const item = await card(); const old = await reserve(item);
  await db.query("update public.orders set reservation_expires_at=now()-interval '1 second' where id=$1", [old.id]);
  const current = await reserve(item); assert.notEqual(current.id, old.id);
  await assert.rejects(claim(old), /expired/);
  assert.equal((await claim(current)).state, 'claimed');
});
test('capture uncertainty holds stock beyond ordinary expiry and cannot be cancelled', async () => {
  const item = await card(); const o = await reserve(item); assert.equal((await claim(o)).state, 'claimed');
  await db.query("update public.orders set reservation_expires_at=now()-interval '1 day' where id=$1", [o.id]);
  await db.query('select public.expire_checkouts()');
  await assert.rejects(reserve(item), /temporarily reserved/);
  assert.equal((await db.query('select public.cancel_checkout($1,$2) as result', [o.id, session])).rows[0].result, false);
  assert.equal((await claim(o)).state, 'processing');
});
test('cancellation is session-bound and safely releases only an uncaptured checkout', async () => {
  const item = await card(); const o = await reserve(item);
  assert.equal((await db.query('select public.cancel_checkout($1,$2) as result', [o.id, 'b'.repeat(64)])).rows[0].result, false);
  assert.equal((await db.query('select public.cancel_checkout($1,$2) as result', [o.id, session])).rows[0].result, true);
  await reserve(item);
});

test('cancel safely retries a failed reservation or an already-expired checkout', async () => {
  assert.equal((await db.query('select public.cancel_checkout($1,$2) as result', [randomUUID(), session])).rows[0].result, true);
  const o = await reserve(await card());
  await db.query("update public.orders set reservation_expires_at=now()-interval '1 second' where id=$1", [o.id]);
  await db.query('select public.expire_checkouts()');
  assert.equal((await db.query('select public.cancel_checkout($1,$2) as result', [o.id, session])).rows[0].result, true);
});
test('completed payment owns stock once and duplicate webhook creates only one email', async () => {
  const item = await card(); const o = await reserve(item); await claim(o);
  const args = [o.id, o.id, 'CAPTURE1', 'test@example.test', '{}', '{}'];
  for (let i = 0; i < 2; i++) assert.equal((await db.query('select public.settle_checkout_payment($1,$2,$3,$4,$5,$6) as result', args)).rows[0].result, 'completed');
  assert.equal((await db.query('select count(*)::integer as n from public.order_emails where order_id=$1', [o.id])).rows[0].n, 1);
  assert.equal((await db.query('select available,sold_at from public."Card" where id=$1', [item])).rows[0].available, false);
  await assert.rejects(reserve(item), /no longer available/);
  await assert.rejects(db.query('select public.edit_inventory_card($1,$2,false)', [item, '{"available":true}']), /Sold cards/);
});
test('reserved listings cannot be edited or deleted', async () => {
  const item = await card(); await reserve(item);
  await assert.rejects(db.query('select public.edit_inventory_card($1,$2,false)', [item, '{"price":20}']), /reserved/);
  await assert.rejects(db.query('select public.edit_inventory_card($1,$2,true)', [item, '{}']), /reserved/);
});
test('anonymous users can read saleable stock but cannot write it or call private functions', async () => {
  const item = await card();
  await db.exec('set role anon');
  try {
    assert.equal((await db.query('select id from public."Card" where id=$1', [item])).rows.length, 1);
    await assert.rejects(db.query('update public."Card" set price=1 where id=$1', [item]), /permission denied/);
    await assert.rejects(db.query('select public.expire_checkouts()'), /permission denied/);
    await assert.rejects(db.query("insert into public.rarities values ('injected')"), /permission denied/);
    await assert.rejects(db.query('select * from public._prisma_migrations'), /permission denied/);
  } finally { await db.exec('reset role'); }
});

test('a legacy captured payment with conflicting stock is quarantined and cannot dispatch', async () => {
  const item=await card();const held=await reserve(item);await claim(held);
  const legacy=randomUUID();
  await db.query("insert into public.orders(id,items,shipping,paypal_order_id) values($1::uuid,$2,$3,$1::text)",[legacy,JSON.stringify([{id:item,price:1000,quantity:1}]),JSON.stringify(shipping)]);
  assert.equal((await db.query('select public.settle_checkout_payment($1::uuid,$1::text,$2,$3,$4,$4) as state',[legacy,'LEGACYCAPTURE','test@example.test','{}'])).rows[0].state,'payment_review');
  assert.equal((await db.query('select count(*)::integer as n from public.order_emails where order_id=$1',[legacy])).rows[0].n,0);
  await assert.rejects(db.query("select public.dispatch_order($1,'AB123456789GB','{}')",[legacy]),/Resolve payment review/);
  await assert.rejects(reserve(item),/no longer available/);
});
test('agent checks are paused in storage and parallel run requests are suppressed',async()=>{
  await db.exec('update public.agent_settings set paused=true');
  assert.equal((await db.query("select public.start_agent_run('manual') as id")).rows[0].id,null);
  await db.exec('update public.agent_settings set paused=false');
  const id=(await db.query("select public.start_agent_run('manual') as id")).rows[0].id;
  assert.ok(id);
  assert.equal((await db.query("select public.start_agent_run('manual') as id")).rows[0].id,null);
  await db.query('select public.finish_agent_run($1,$2,$3)',[id,'{}','[]']);
});
async function proposal(item){
  const snapshot=(await db.query('select jsonb_build_object(\'price\',price,\'available\',available,\'updatedAt\',"updatedAt") as value from public."Card" where id=$1',[item])).rows[0].value;
  const id=randomUUID();
  await db.query("insert into public.agent_actions(id,kind,title,detail,severity,card_id,snapshot) values($1,'withdraw_listing','Review listing','Check price','warning',$2,$3)",[id,item,JSON.stringify(snapshot)]);
  return id;
}
test('approval checks the exact listing version and stale approval changes nothing',async()=>{
  const item=await card();const action=await proposal(item);
  await db.query('select public.edit_inventory_card($1,$2,false)',[item,'{"price":999}']);
  const result=(await db.query("select public.decide_agent_action($1,'approve','test-owner') as state",[action])).rows[0];
  assert.equal(result.state,'stale');assert.equal((await db.query('select available from public."Card" where id=$1',[item])).rows[0].available,true);
});
test('approval executes once and cannot spend money or hide reserved stock',async()=>{
  const item=await card();const action=await proposal(item);
  await reserve(item);
  await assert.rejects(db.query("select public.decide_agent_action($1,'approve','test-owner')",[action]),/reserved/);
  await assert.rejects(db.query('update public.agent_settings set spend_limit_pence=1'),/check constraint/);
  const free=await card();const freeAction=await proposal(free);
  for(let i=0;i<2;i++)assert.equal((await db.query("select public.decide_agent_action($1,'approve','test-owner') as state",[freeAction])).rows[0].state,'executed');
  assert.equal((await db.query("select count(*)::integer as n from public.agent_events where title='Listing hidden with approval' and detail='Review listing'")).rows[0].n,1);
});

async function webDraft(path='/shop', overrides={}) {
  const id=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
  const revision=(await db.query('select revision from public.web_page_metadata where path=$1',[path])).rows[0].revision;
  await db.query(`insert into public.web_agent_actions(id,scope,kind,path,title,detail,severity,snapshot) values($1,'seo',$2,$3,'Test draft','Review exact text','attention',$4)`,[id,overrides.kind||'seo_metadata',path,JSON.stringify({revision,after:{title:'Approved title',description:'Approved description',canonical:'https://www.gayretrotcg.com'+path},...overrides.snapshot})]);
  return id;
}
test('SEO publish is owner-only, atomic, exact and idempotent',async()=>{
  const id=await webDraft();
  await assert.rejects(db.exec(`set role anon; select public.decide_web_agent_action('${id}','approve','intruder')`),/permission denied/);await db.exec('reset role');
  await db.query('select public.decide_web_agent_action($1,$2,$3)',[id,'approve','owner']);
  await db.query('select public.decide_web_agent_action($1,$2,$3)',[id,'approve','owner']);
  const doc=(await db.query("select title,description,revision from public.web_page_metadata where path='/shop'")).rows[0];
  assert.deepEqual(doc,{title:'Approved title',description:'Approved description',revision:1});
  assert.equal((await db.query("select count(*)::int as n from public.agent_events where title='SEO metadata approved'")).rows[0].n,1);
});
test('expired SEO approval cannot change the page',async()=>{
  const id=await webDraft('/contact');await db.query("update public.web_agent_actions set expires_at=now()-interval '1 second' where id=$1",[id]);
  assert.equal((await db.query("select public.decide_web_agent_action($1,'approve','owner') as state",[id])).rows[0].state,'stale');
  assert.equal((await db.query("select title from public.web_page_metadata where path='/contact'")).rows[0].title,null);
});
test('competing metadata draft becomes stale after another approval',async()=>{
  const first=await webDraft('/delivery');const second=await webDraft('/delivery');
  await db.query("select public.decide_web_agent_action($1,'approve','owner')",[first]);
  assert.equal((await db.query("select public.decide_web_agent_action($1,'approve','owner') as state",[second])).rows[0].state,'stale');
});
test('maintenance findings cannot execute code and malformed SEO cannot publish',async()=>{
  const review=await webDraft('/returns',{kind:'web_review'});
  await assert.rejects(db.query("select public.decide_web_agent_action($1,'approve','owner')",[review]),/reviewed code change/);
  const invalid=await webDraft('/returns',{snapshot:{after:{title:'Bad',description:'Bad',canonical:'https://evil.test'}}});
  await assert.rejects(db.query("select public.decide_web_agent_action($1,'approve','owner')",[invalid]),/Invalid metadata/);
});
test('incomplete and old store checks cannot resolve unrelated website findings',async()=>{
  const id=await webDraft('/');const run=randomUUID();
  await db.query("insert into public.agent_runs(id,trigger_source,status) values($1,'manual','running')",[run]);
  await db.query('select public.save_web_agent_findings($1,$2,$3)',[run,'[]','["maintenance:/"]']);
  assert.equal((await db.query('select state from public.web_agent_actions where id=$1',[id])).rows[0].state,'pending');
  await db.query('select public.finish_agent_run($1,$2,$3)',[run,'{}','[]']);
  assert.equal((await db.query('select state from public.web_agent_actions where id=$1',[id])).rows[0].state,'pending');
});
test('complete scoped scan resolves old findings but keeps dismissed drafts dismissed',async()=>{
  const id=await webDraft('/returns');await db.query("select public.decide_web_agent_action($1,'dismiss','owner')",[id]);
  const run=randomUUID();await db.query("insert into public.agent_runs(id,trigger_source,status) values($1,'manual','running')",[run]);
  const action=(await db.query('select * from public.web_agent_actions where id=$1',[id])).rows[0];
  await db.query('select public.save_web_agent_findings($1,$2,$3)',[run,JSON.stringify([action]),'["seo:/returns"]']);
  assert.equal((await db.query('select state from public.web_agent_actions where id=$1',[id])).rows[0].state,'dismissed');
  assert.equal((await db.query("select count(*)::int as n from public.web_agent_actions where path='/returns' and state='pending'")).rows[0].n,0);
});
test('restore is revision-bound and cannot undo a newer owner decision',async()=>{
  assert.equal((await db.query("select public.restore_page_metadata('/shop',0,'owner') as state")).rows[0].state,'stale');
  assert.equal((await db.query("select public.restore_page_metadata('/shop',1,'owner') as state")).rows[0].state,'restored');
  const row=(await db.query("select title,revision from public.web_page_metadata where path='/shop'")).rows[0];assert.deepEqual(row,{title:null,revision:2});
  await assert.rejects(db.exec('set role anon; select * from public.web_page_metadata'),/permission denied/);await db.exec('reset role');
});
