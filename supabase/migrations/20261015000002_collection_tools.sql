alter table public."Card" add column if not exists front_image_url text, add column if not exists back_image_url text, add column if not exists sold_at timestamptz;
create table if not exists public.card_economics(card_id text primary key references public."Card"(id) on delete cascade,cost_pence integer check(cost_pence>=0),acquired_at date,updated_at timestamptz not null default now());
alter table public.card_economics enable row level security;
revoke all on public.card_economics from public,anon,authenticated;
grant all on public.card_economics to service_role;
alter table public.orders add column if not exists delivery_address jsonb, add column if not exists payment_fee_pence integer check(payment_fee_pence>=0),add column if not exists carrier_cost_pence integer check(carrier_cost_pence>=0),add column if not exists carrier_order_id text;
create index if not exists card_available_created_idx on public."Card"(available,"createdAt" desc,id);
