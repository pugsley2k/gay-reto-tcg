alter table public.orders
  add column if not exists paypal_order_id text,
  add column if not exists capture_id text,
  add column if not exists customer_email text,
  add column if not exists paid_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists dispatched_at timestamptz;
create unique index if not exists orders_paypal_order_id_key on public.orders(paypal_order_id);
create table if not exists public.order_emails (
  id text primary key,
  order_id uuid not null references public.orders(id),
  kind text not null check (kind in ('confirmation','tracking')),
  recipient text not null,
  message jsonb not null,
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  last_error text,
  lease_id uuid,
  locked_until timestamptz
);
alter table public.orders enable row level security;
alter table public.order_emails enable row level security;
revoke all on public.orders, public.order_emails from anon, authenticated;
grant all on public.orders, public.order_emails to service_role;
create or replace function public.complete_paid_order(p_id uuid,p_paypal_id text,p_capture_id text,p_email text,p_message jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare selected_order public.orders%rowtype;
begin
  select * into selected_order from public.orders where id=p_id and paypal_order_id=p_paypal_id for update;
  if not found then raise exception 'Order not found'; end if;
  if selected_order.capture_id is not null and selected_order.capture_id <> p_capture_id then raise exception 'Capture mismatch'; end if;
  update public."Card" set available=false where id in (select item->>'id' from jsonb_array_elements(selected_order.items) item);
  update public.orders set status='completed',capture_id=p_capture_id,customer_email=p_email,paid_at=coalesce(paid_at,now()) where id=p_id;
  insert into public.order_emails(id,order_id,kind,recipient,message) values(p_id::text || '-confirmation',p_id,'confirmation',p_email,p_message) on conflict(id) do nothing;
end $$;
revoke all on function public.complete_paid_order(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_paid_order(uuid,text,text,text,jsonb) to service_role;
