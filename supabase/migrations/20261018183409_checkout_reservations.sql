-- Apply with the matching application release. All money/stock mutations are server-only.
alter table public.orders
  add column checkout_state text check (checkout_state in ('reserved','capturing','completed','cancelled','expired','payment_review')),
  add column reservation_expires_at timestamptz,
  add column checkout_session_hash text,
  add column capture_started_at timestamptz,
  add column capture_lease_until timestamptz,
  add column payment_issue text;

create table public.checkout_reservations (
  card_id text primary key references public."Card"(id),
  order_id uuid not null references public.orders(id),
  created_at timestamptz not null default now()
);
create index checkout_reservations_order_idx on public.checkout_reservations(order_id);
create table public.card_sales (
  card_id text primary key references public."Card"(id),
  order_id uuid not null references public.orders(id)
);
-- Preserve historic ownership. Abort rather than guess if historical paid orders overlap.
insert into public.card_sales(card_id,order_id)
select item->>'id',o.id from public.orders o cross join lateral jsonb_array_elements(o.items) item
join public."Card" c on c.id=item->>'id' where o.paid_at is not null;
alter table public.checkout_reservations enable row level security;
alter table public.card_sales enable row level security;
revoke all on public.checkout_reservations,public.card_sales from public,anon,authenticated;
grant all on public.checkout_reservations,public.card_sales to service_role;

-- Storefront reads remain public; inventory writes move to authenticated server routes.
alter table public."Card" enable row level security;
drop policy if exists "Allow insert for anon" on public."Card";
revoke all on public."Card" from public,anon,authenticated;
grant select on public."Card" to anon,authenticated;
grant all on public."Card" to service_role;
create policy card_storefront_read on public."Card" for select to anon,authenticated
using (available or sold_at is not null);

-- Catalogue lookups are public reads; maintenance metadata is private.
do $$ declare lookup_name text; begin
  foreach lookup_name in array array['rarities','finishes','setnames'] loop
    execute format('alter table public.%I enable row level security',lookup_name);
    execute format('revoke all on public.%I from public,anon,authenticated',lookup_name);
    execute format('grant select on public.%I to anon,authenticated',lookup_name);
    execute format('grant all on public.%I to service_role',lookup_name);
    execute format('create policy catalogue_read on public.%I for select to anon,authenticated using (true)',lookup_name);
  end loop;
end $$;
alter table public._prisma_migrations enable row level security;
revoke all on public._prisma_migrations from public,anon,authenticated;


create function public.reserve_checkout(p_id uuid,p_items jsonb,p_shipping jsonb,p_session_hash text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype; ids text[]; subtotal bigint; inserted boolean;
begin
  if p_session_hash !~ '^[a-f0-9]{64}$' or p_session_hash is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout'; end if;
  select array_agg(item->>'id' order by item->>'id') into ids from jsonb_array_elements(p_items) item;
  if (select count(distinct x) from unnest(ids) x)<>cardinality(ids) or 'demo-gardevoir-ex'=any(ids)
     or exists(select 1 from jsonb_array_elements(p_items) i where (i->>'quantity')::integer<>1 or i->>'id' is null)
     then raise exception 'Invalid cards'; end if;
  insert into public.orders(id,items,shipping,status,checkout_state,reservation_expires_at,checkout_session_hash)
  values(p_id,p_items,p_shipping,'pending','reserved',clock_timestamp()+interval '15 minutes',p_session_hash)
  on conflict(id) do nothing;
  inserted:=found;
  select * into o from public.orders where id=p_id for update;
  if o.checkout_session_hash is distinct from p_session_hash then raise exception 'Checkout belongs to another session'; end if;
  if not inserted then
    if o.items is distinct from p_items or o.shipping is distinct from p_shipping then raise exception 'Checkout details changed'; end if;
    if o.checkout_state<>'reserved' or o.reservation_expires_at<=clock_timestamp() then raise exception 'Checkout expired; start again'; end if;
    return to_jsonb(o);
  end if;
  -- All workflows lock cards in the same order. An overlapping checkout waits here.
  perform id from public."Card" where id=any(ids) order by id for update;
  if (select count(*) from public."Card" where id=any(ids) and available and sold_at is null)<>cardinality(ids)
     or exists(select 1 from public.card_sales where card_id=any(ids)) then raise exception 'A card is no longer available'; end if;
  if exists(select 1 from public."Card" c join jsonb_array_elements(p_items) i on c.id=i->>'id'
            where c.price<>(i->>'price')::integer or c.price<0) then raise exception 'Card prices changed; refresh your cart'; end if;
  select sum(price) into subtotal from public."Card" where id=any(ids);
  if subtotal<30 or subtotal<>(p_shipping->>'subtotal')::bigint
     or (p_shipping->>'total')::bigint<>subtotal-(p_shipping->>'discount')::bigint+(p_shipping->>'price')::bigint
     or p_shipping->>'country'<>'GB' then raise exception 'Invalid checkout total'; end if;
  if exists(select 1 from public.checkout_reservations r join public.orders holder on holder.id=r.order_id
    where r.card_id=any(ids) and (holder.checkout_state in ('capturing','payment_review')
      or (holder.checkout_state='reserved' and holder.reservation_expires_at>clock_timestamp())))
    then raise exception 'A card is temporarily reserved by another customer'; end if;
  delete from public.checkout_reservations where card_id=any(ids);
  insert into public.checkout_reservations(card_id,order_id) select unnest(ids),p_id;
  return to_jsonb(o);
end $$;

create function public.begin_checkout_capture(p_paypal_id text,p_session_hash text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype; ids text[];
begin
  select * into o from public.orders where paypal_order_id=p_paypal_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.checkout_session_hash is not null and o.checkout_session_hash is distinct from p_session_hash
    then raise exception 'Return to the browser where you started checkout'; end if;
  if o.paid_at is not null then return jsonb_build_object('state',coalesce(o.checkout_state,'completed'),'id',o.id); end if;
  if o.checkout_state='payment_review' then return jsonb_build_object('state','payment_review','id',o.id); end if;
  if o.checkout_state='capturing' then
    if o.capture_started_at<clock_timestamp()-interval '5 hours' then
      return jsonb_build_object('state','payment_review','id',o.id);
    end if;
    if o.capture_lease_until>clock_timestamp() then return jsonb_build_object('state','processing','id',o.id); end if;
    update public.orders set capture_lease_until=clock_timestamp()+interval '60 seconds' where id=o.id;
    return jsonb_build_object('state','claimed','id',o.id);
  end if;
  if o.checkout_state in ('cancelled','expired') or (o.checkout_state='reserved' and o.reservation_expires_at<=clock_timestamp())
    then raise exception 'Checkout expired; payment has not been taken. Start again from your cart'; end if;
  select array_agg(i->>'id' order by i->>'id') into ids from jsonb_array_elements(o.items) i;
  perform id from public."Card" where id=any(ids) order by id for update;
  if (select count(*) from public."Card" where id=any(ids) and available and sold_at is null)<>cardinality(ids)
     or exists(select 1 from public.card_sales where card_id=any(ids)) then raise exception 'A card is no longer available; payment has not been taken'; end if;
  if o.checkout_state is null then
    -- Safely admit orders created by the previous application release before capturing them.
    if exists(select 1 from public.checkout_reservations r join public.orders holder on holder.id=r.order_id
      where r.card_id=any(ids) and r.order_id<>o.id and (holder.checkout_state in ('capturing','payment_review')
        or (holder.checkout_state='reserved' and holder.reservation_expires_at>clock_timestamp())))
      then raise exception 'A card is reserved; payment has not been taken'; end if;
    delete from public.checkout_reservations where card_id=any(ids);
    insert into public.checkout_reservations(card_id,order_id) select unnest(ids),o.id;
  elsif (select count(*) from public.checkout_reservations where order_id=o.id and card_id=any(ids))<>cardinality(ids)
    then raise exception 'Reservation is no longer valid; payment has not been taken'; end if;
  update public.orders set checkout_state='capturing',capture_started_at=clock_timestamp(),
    capture_lease_until=clock_timestamp()+interval '60 seconds' where id=o.id;
  return jsonb_build_object('state','claimed','id',o.id);
end $$;

create function public.cancel_checkout(p_id uuid,p_session_hash text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_id for update;
  -- A failed reservation may never have inserted an order. Releasing nothing is safe.
  if not found then return true; end if;
  if o.checkout_session_hash is distinct from p_session_hash then return false; end if;
  if o.checkout_state in ('cancelled','expired') and o.paid_at is null then return true; end if;
  if o.checkout_state<>'reserved' or o.paid_at is not null then return false; end if;
  perform c.id from public."Card" c join public.checkout_reservations r on r.card_id=c.id where r.order_id=o.id order by c.id for update of c;
  update public.orders set checkout_state='cancelled',status='cancelled' where id=o.id;
  delete from public.checkout_reservations where order_id=o.id;
  return true;
end $$;

create function public.expire_checkouts()
returns integer language plpgsql security invoker set search_path=public as $$
declare o record; expired_count integer:=0;
begin
  for o in select id from public.orders where checkout_state='reserved' and reservation_expires_at<=clock_timestamp()
    order by id for update skip locked limit 200 loop
    perform c.id from public."Card" c join public.checkout_reservations r on r.card_id=c.id where r.order_id=o.id order by c.id for update of c;
    update public.orders set checkout_state='expired',status='expired' where id=o.id;
    delete from public.checkout_reservations where order_id=o.id;
    expired_count:=expired_count+1;
  end loop;
  return expired_count;
end $$;

create function public.settle_checkout_payment(p_id uuid,p_paypal_id text,p_capture_id text,p_email text,p_message jsonb,p_details jsonb)
returns text language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype; ids text[]; conflict_found boolean;
begin
  select * into o from public.orders where id=p_id and paypal_order_id=p_paypal_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.capture_id is not null and o.capture_id<>p_capture_id then raise exception 'Capture mismatch'; end if;
  if o.paid_at is not null then return coalesce(o.checkout_state,'completed'); end if;
  select array_agg(i->>'id' order by i->>'id') into ids from jsonb_array_elements(o.items) i;
  perform id from public."Card" where id=any(ids) order by id for update;
  conflict_found:=(select count(*) from public."Card" where id=any(ids))<>cardinality(ids)
    or exists(select 1 from public.card_sales where card_id=any(ids) and order_id<>p_id)
    or exists(select 1 from public.checkout_reservations where card_id=any(ids) and order_id<>p_id)
    or (o.checkout_state is not null and (o.checkout_state<>'capturing'
      or (select count(*) from public.checkout_reservations where card_id=any(ids) and order_id=p_id)<>cardinality(ids)));
  update public.orders set capture_id=p_capture_id,paid_at=clock_timestamp(),customer_email=p_email,
    delivery_address=p_details->'address',payment_fee_pence=(p_details->>'fee')::integer,
    checkout_state=case when conflict_found then 'payment_review' else 'completed' end,
    status=case when conflict_found then 'payment_review' else 'completed' end,
    payment_issue=case when conflict_found then 'Captured payment requires inventory review' else null end,
    capture_lease_until=null where id=p_id;
  if conflict_found then
    -- Record captured money, quarantine the affected stock and withhold ordinary confirmation.
    update public."Card" set available=false where id=any(ids);
    return 'payment_review';
  end if;
  insert into public.card_sales(card_id,order_id) select unnest(ids),p_id on conflict(card_id) do nothing;
  update public."Card" set available=false,sold_at=coalesce(sold_at,now()) where id=any(ids);
  delete from public.checkout_reservations where order_id=p_id;
  insert into public.order_emails(id,order_id,kind,recipient,message)
    values(p_id::text||'-confirmation',p_id,'confirmation',p_email,p_message) on conflict(id) do nothing;
  return 'completed';
end $$;

-- Compatibility for the previous deployed webhook during the release transition.
create or replace function public.complete_paid_order(p_id uuid,p_paypal_id text,p_capture_id text,p_email text,p_message jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin perform public.settle_checkout_payment(p_id,p_paypal_id,p_capture_id,p_email,p_message,'{}'::jsonb); end $$;
create or replace function public.complete_paid_order(p_id uuid,p_paypal_id text,p_capture_id text,p_email text,p_message jsonb,p_details jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin perform public.settle_checkout_payment(p_id,p_paypal_id,p_capture_id,p_email,p_message,p_details); end $$;

-- Payment review also blocks the existing dispatch workflow, including carrier sync.
create or replace function public.dispatch_order(p_id uuid,p_tracking text,p_message jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare selected_order public.orders%rowtype;
begin
  select * into selected_order from public.orders where id=p_id for update;
  if not found or selected_order.paid_at is null or selected_order.customer_email is null then raise exception 'Paid order required'; end if;
  if selected_order.checkout_state='payment_review' then raise exception 'Resolve payment review before dispatch'; end if;
  if p_tracking !~ '^[A-Z0-9]{8,30}$' then raise exception 'Invalid tracking'; end if;
  if selected_order.tracking_number is not null and selected_order.tracking_number<>p_tracking then raise exception 'Tracking already recorded'; end if;
  update public.orders set tracking_number=p_tracking,dispatched_at=coalesce(dispatched_at,now()) where id=p_id;
  insert into public.order_emails(id,order_id,kind,recipient,message) values(p_id::text||'-tracking-'||p_tracking,p_id,'tracking',selected_order.customer_email,p_message) on conflict(id) do nothing;
end $$;

create function public.edit_inventory_card(p_id text,p_updates jsonb,p_delete boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare c public."Card"%rowtype;
begin
  select * into c from public."Card" where id=p_id for update;
  if not found then raise exception 'Card not found'; end if;
  if exists(select 1 from public.checkout_reservations r join public.orders o on o.id=r.order_id where r.card_id=p_id
    and (o.checkout_state in ('capturing','payment_review') or (o.checkout_state='reserved' and o.reservation_expires_at>clock_timestamp())))
    then raise exception 'This card is reserved for checkout. Wait for payment or expiry'; end if;
  if (p_delete or (p_updates->>'available')::boolean is true)
    and (c.sold_at is not null or exists(select 1 from public.card_sales where card_id=p_id))
    then raise exception 'Sold cards cannot be deleted or relisted. Review any return first'; end if;
  if p_delete then
    delete from public.checkout_reservations where card_id=p_id;
    delete from public."Card" where id=p_id;
  else
    update public."Card" set
      price=case when p_updates?'price' then (p_updates->>'price')::integer else price end,
      image_url=case when p_updates?'image_url' then p_updates->>'image_url' else image_url end,
      condition=case when p_updates?'condition' then p_updates->>'condition' else condition end,
      edition=case when p_updates?'edition' then p_updates->>'edition' else edition end,
      holo_type=case when p_updates?'holo_type' then p_updates->>'holo_type' else holo_type end,
      available=case when p_updates?'available' then (p_updates->>'available')::boolean else available end,
      "updatedAt"=clock_timestamp() where id=p_id;
  end if;
end $$;

revoke all on function public.reserve_checkout(uuid,jsonb,jsonb,text),public.begin_checkout_capture(text,text),
 public.cancel_checkout(uuid,text),public.expire_checkouts(),public.settle_checkout_payment(uuid,text,text,text,jsonb,jsonb),
 public.edit_inventory_card(text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.reserve_checkout(uuid,jsonb,jsonb,text),public.begin_checkout_capture(text,text),
 public.cancel_checkout(uuid,text),public.expire_checkouts(),public.settle_checkout_payment(uuid,text,text,text,jsonb,jsonb),
 public.edit_inventory_card(text,jsonb,boolean) to service_role;
