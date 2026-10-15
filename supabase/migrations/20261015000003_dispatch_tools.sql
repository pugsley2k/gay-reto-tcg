create table public.integration_credentials(id text primary key, encrypted_value text not null, updated_at timestamptz not null default now());
alter table public.integration_credentials enable row level security;
revoke all on public.integration_credentials from public,anon,authenticated;
grant all on public.integration_credentials to service_role;
alter table public.orders add column carrier_import_locked_until timestamptz;
create function public.complete_paid_order(p_id uuid,p_paypal_id text,p_capture_id text,p_email text,p_message jsonb,p_details jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform public.complete_paid_order(p_id,p_paypal_id,p_capture_id,p_email,p_message);
 update public.orders set delivery_address=coalesce(delivery_address,p_details->'address'),payment_fee_pence=coalesce(payment_fee_pence,(p_details->>'fee')::integer) where id=p_id;
 update public."Card" set sold_at=coalesce(sold_at,now()) where id in (select item->>'id' from public.orders o, lateral jsonb_array_elements(o.items) item where o.id=p_id);
end $$;
revoke all on function public.complete_paid_order(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_paid_order(uuid,text,text,text,jsonb,jsonb) to service_role;
