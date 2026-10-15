create or replace function public.dispatch_order(p_id uuid,p_tracking text,p_message jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare selected_order public.orders%rowtype;
begin
  select * into selected_order from public.orders where id=p_id for update;
  if not found or selected_order.paid_at is null or selected_order.customer_email is null then raise exception 'Paid order required'; end if;
  if p_tracking !~ '^[A-Z0-9]{8,30}$' then raise exception 'Invalid tracking'; end if;
  if selected_order.tracking_number is not null and selected_order.tracking_number<>p_tracking then raise exception 'Tracking already recorded'; end if;
  update public.orders set tracking_number=p_tracking,dispatched_at=coalesce(dispatched_at,now()) where id=p_id;
  insert into public.order_emails(id,order_id,kind,recipient,message) values(p_id::text || '-tracking-' || p_tracking,p_id,'tracking',selected_order.customer_email,p_message) on conflict(id) do nothing;
end $$;
revoke all on function public.dispatch_order(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.dispatch_order(uuid,text,jsonb) to service_role;
