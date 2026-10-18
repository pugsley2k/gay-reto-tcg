-- Private, event-driven drafts. No remote requests, video storage or publishing.
create table public.card_promos (
  card_id text primary key references public."Card"(id) on delete cascade,
  revision integer not null default 1 check(revision>0),
  state text not null default 'pending' check(state in ('pending','exported','dismissed','unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  exported_at timestamptz
);
alter table public.card_promos enable row level security;
revoke all on public.card_promos from public,anon,authenticated;
grant all on public.card_promos to service_role;
create index card_promos_updated_idx on public.card_promos(updated_at desc);

create function public.queue_card_promo() returns trigger language plpgsql security invoker set search_path='' as $$
declare eligible boolean;
begin
  if new.id like 'demo-%' then return new; end if;
  if TG_OP='UPDATE' then
    if (new.name,new.price,new.available,new.sold_at,new.image_url,new.front_image_url,new.back_image_url,new."set",new.number,new.condition,new.grading)
       is not distinct from (old.name,old.price,old.available,old.sold_at,old.image_url,old.front_image_url,old.back_image_url,old."set",old.number,old.condition,old.grading) then return new; end if;
  end if;
  eligible:=coalesce(new.available and new.sold_at is null and new.price>=30,false);
  if eligible then
    insert into public.card_promos(card_id) values(new.id)
      on conflict(card_id) do update set revision=public.card_promos.revision+1,state='pending',updated_at=now(),exported_at=null;
  else
    update public.card_promos set revision=revision+1,state='unavailable',updated_at=now(),exported_at=null where card_id=new.id;
  end if;
  return new;
end $$;
revoke all on function public.queue_card_promo() from public,anon,authenticated;
grant execute on function public.queue_card_promo() to service_role;
create trigger card_promo_listing_changed after insert or update on public."Card" for each row execute function public.queue_card_promo();

insert into public.card_promos(card_id)
select id from public."Card" where available and sold_at is null and price>=30 and id not like 'demo-%';

create function public.card_promo_details(p_card text,p_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public."Card"%rowtype; p public.card_promos%rowtype;
begin
  -- Same lock order as inventory mutation: card, then draft.
  select * into c from public."Card" where id=p_card for update;
  select * into p from public.card_promos where card_id=p_card for update;
  if p.card_id is null or p.revision<>p_revision then raise exception 'Listing changed. Refresh the promo before exporting.'; end if;
  if not c.available or c.sold_at is not null or c.price<30 or p.state='unavailable' then raise exception 'This card is no longer available for a promo.'; end if;
  if exists(select 1 from public.checkout_reservations r join public.orders o on o.id=r.order_id
    where r.card_id=p_card and (o.checkout_state in ('capturing','payment_review') or (o.checkout_state='reserved' and o.reservation_expires_at>clock_timestamp()))) then raise exception 'This card is currently held for checkout. Try again after the reservation ends.'; end if;
  return jsonb_build_object('id',c.id,'name',c.name,'price',c.price,'available',c.available,'sold_at',c.sold_at,
    'image_url',c.image_url,'front_image_url',c.front_image_url,'back_image_url',c.back_image_url,'set',c."set",'number',c.number,'condition',c.condition,'grading',c.grading);
end $$;
create function public.decide_card_promo(p_card text,p_revision integer,p_decision text,p_actor text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_decision not in ('exported','dismissed') then raise exception 'Invalid promo decision.'; end if;
  perform public.card_promo_details(p_card,p_revision);
  update public.card_promos set state=p_decision,exported_at=case when p_decision='exported' then now() else exported_at end where card_id=p_card;
  insert into public.agent_events(actor_id,title,detail) values(p_actor,
    case when p_decision='exported' then 'Card promo exported' else 'Card promo dismissed' end,
    p_card || ' · listing revision ' || p_revision || '. Nothing posted to TikTok.');
end $$;
revoke all on function public.card_promo_details(text,integer),public.decide_card_promo(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.card_promo_details(text,integer),public.decide_card_promo(text,integer,text,text) to service_role;

