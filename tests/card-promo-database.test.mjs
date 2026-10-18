import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
const db=new PGlite();
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public."Card"(id text primary key,name text,price integer,available boolean,sold_at timestamptz,image_url text,front_image_url text,back_image_url text,"set" text,number text,condition text,grading jsonb);
 create table public.orders(id text primary key,checkout_state text,reservation_expires_at timestamptz);
 create table public.checkout_reservations(card_id text,order_id text);
 create table public.agent_events(actor_id text,title text,detail text);
 grant usage on schema public to anon,authenticated,service_role;grant all on public."Card",public.orders,public.checkout_reservations,public.agent_events to service_role;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261018204942_card_promo_queue.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
async function insert(id){await db.query(`insert into public."Card"(id,name,price,available,image_url) values($1,'Charizard',10000,true,'https://images.pokemontcg.io/base1/4_hires.png')`,[id]);}
async function row(id){return(await db.query('select * from public.card_promos where card_id=$1',[id])).rows[0];}
test('new listings queue once; bookkeeping updates preserve decisions; offer changes invalidate exports',async()=>{
 await insert('new');assert.equal((await row('new')).revision,1);
 await db.query("select public.decide_card_promo('new',1,'exported','owner')");
 await db.query('update public."Card" set price=price where id=$1',['new']);assert.equal((await row('new')).state,'exported');
 await db.query('update public."Card" set price=12000 where id=$1',['new']);assert.equal((await row('new')).revision,2);assert.equal((await row('new')).state,'pending');
 await assert.rejects(db.query("select public.decide_card_promo('new',1,'exported','owner')"),/Listing changed/);
});
test('hidden and sold listings block exports; restocking refreshes draft',async()=>{
 await insert('sold');await db.query('update public."Card" set available=false where id=$1',['sold']);assert.equal((await row('sold')).state,'unavailable');
 await assert.rejects(db.query("select public.card_promo_details('sold',2)"),/no longer available/);
 await db.query('update public."Card" set available=true where id=$1',['sold']);assert.equal((await row('sold')).revision,3);assert.equal((await row('sold')).state,'pending');
 await db.query('update public."Card" set sold_at=now() where id=$1',['sold']);await assert.rejects(db.query("select public.card_promo_details('sold',4)"),/no longer available/);
});
test('checkout reservations and uncertain captures block promo preparation',async()=>{
 await insert('held');await db.exec("insert into public.orders values('o','reserved',now()+interval '10 minutes');insert into public.checkout_reservations values('held','o');");
 await assert.rejects(db.query("select public.card_promo_details('held',1)"),/held for checkout/);
 await db.exec("update public.orders set checkout_state='capturing',reservation_expires_at=now()-interval '1 day';");await assert.rejects(db.query("select public.card_promo_details('held',1)"),/held for checkout/);
 await db.exec("update public.orders set checkout_state='cancelled';");assert.equal((await db.query("select public.card_promo_details('held',1) as card")).rows[0].card.name,'Charizard');
});
test('demo listings are excluded; deleting stock removes its draft',async()=>{
 await insert('demo-example');assert.equal(await row('demo-example'),undefined);await insert('deleted');await db.query('delete from public."Card" where id=$1',['deleted']);assert.equal(await row('deleted'),undefined);
});
test('promo queue and decision functions are inaccessible to public users; service role can operate',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);try{await assert.rejects(db.query('select * from public.card_promos'),/permission denied/);await assert.rejects(db.query("select public.decide_card_promo('new',2,'exported','attacker')"),/permission denied/);}finally{await db.exec('reset role');}
 }
 await db.exec('set role service_role');try{await db.query("select public.decide_card_promo('new',2,'dismissed','owner')");assert.equal((await row('new')).state,'dismissed');}finally{await db.exec('reset role');}
});
