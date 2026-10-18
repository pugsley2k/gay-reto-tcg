create table public.promo_workers (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 name text not null default 'Shop PC', enabled boolean not null default true, last_seen_at timestamptz,
 account_hash text, account_label text, tiktok_connected boolean not null default false, last_error text,
 created_at timestamptz not null default now()
);
create table public.card_promo_media (
 id uuid primary key default gen_random_uuid(), card_id text not null references public."Card"(id) on delete cascade,
 revision integer not null, render_state text not null default 'queued' check(render_state in ('queued','rendering','ready','failed')),
 worker_id uuid references public.promo_workers(id), lease_id uuid, lease_until timestamptz, attempts integer not null default 0,
 video_path text, video_sha256 text, video_bytes integer, caption text,
 tiktok_state text not null default 'none' check(tiktok_state in ('none','approved','sending','processing','inbox','failed','uncertain','cancelled')),
 approval_id uuid, approved_by text, approved_at timestamptz, approval_expires_at timestamptz, approved_account text,
 publish_id text, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(card_id,revision), check(video_bytes is null or video_bytes between 1000 and 3500000)
);
alter table public.promo_workers enable row level security;
alter table public.card_promo_media enable row level security;
revoke all on public.promo_workers,public.card_promo_media from public,anon,authenticated;
grant all on public.promo_workers,public.card_promo_media to service_role;
create index card_promo_media_state_idx on public.card_promo_media(render_state,tiktok_state,created_at);

create function public.queue_promo_media() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.state='pending' and (TG_OP='INSERT' or new.revision<>old.revision) then
  insert into public.card_promo_media(card_id,revision) values(new.card_id,new.revision) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.queue_promo_media() from public,anon,authenticated;
grant execute on function public.queue_promo_media() to service_role;
create trigger prepare_promo_media after insert or update on public.card_promos for each row execute function public.queue_promo_media();
insert into public.card_promo_media(card_id,revision) select card_id,revision from public.card_promos where state in ('pending','exported');

create function public.claim_promo_render(p_worker uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.card_promo_media%rowtype;
begin
 if not exists(select 1 from public.promo_workers where id=p_worker and enabled) then raise exception 'Worker disabled.'; end if;
 if exists(select 1 from public.agent_settings where paused) then return null; end if;
 -- Hard ceilings keep the worker within a small existing-infrastructure allowance.
 if (select count(*) from public.card_promo_media where render_state='ready')>=30 or
    (select count(*) from public.card_promo_media where render_state='ready' and updated_at>now()-interval '1 day')>=10 then return null; end if;
 select m1.* into m from public.card_promo_media m1 join public.card_promos p on p.card_id=m1.card_id and p.revision=m1.revision
 where p.state not in ('dismissed','unavailable') and (m1.render_state='queued' or (m1.render_state='rendering' and m1.lease_until<now())) and m1.attempts<3
 order by m1.created_at for update of m1 skip locked limit 1;
 if m.id is null then return null; end if;
 update public.card_promo_media set render_state='rendering',worker_id=p_worker,lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now(),last_error=null where id=m.id returning * into m;
 return to_jsonb(m);
end $$;

create function public.finish_promo_render(p_worker uuid,p_id uuid,p_lease uuid,p_path text,p_sha text,p_bytes integer,p_caption text,p_error text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.card_promo_media%rowtype;
begin
 select * into m from public.card_promo_media where id=p_id;
 if m.id is null then raise exception 'Render no longer exists.'; end if;
 perform public.card_promo_details(m.card_id,m.revision);
 select * into m from public.card_promo_media where id=p_id for update;
 if m.render_state<>'rendering' or m.worker_id is distinct from p_worker or m.lease_id is distinct from p_lease or m.lease_until<now() then raise exception 'Render lease expired.'; end if;
 if p_error is not null then
  update public.card_promo_media set render_state='failed',last_error=left(p_error,300),lease_until=null,updated_at=now() where id=p_id; return;
 end if;
 if p_path is null or p_sha is null or p_bytes is null or p_caption is null or p_sha !~ '^[a-f0-9]{64}$' or p_bytes not between 1000 and 3500000 or p_path<>p_id::text||'/'||p_lease::text||'.mp4' or length(p_caption)>2200 then raise exception 'Invalid rendered video.'; end if;
 update public.card_promo_media set render_state='ready',video_path=p_path,video_sha256=p_sha,video_bytes=p_bytes,caption=p_caption,lease_until=null,updated_at=now() where id=p_id;
end $$;

create function public.approve_promo_upload(p_id uuid,p_sha text,p_caption text,p_account text,p_actor text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare m public.card_promo_media%rowtype; approval uuid;
begin
 select * into m from public.card_promo_media where id=p_id;
 if m.id is null then raise exception 'Video not found.'; end if;
 perform public.card_promo_details(m.card_id,m.revision);
 select * into m from public.card_promo_media where id=p_id for update;
 if m.render_state<>'ready' or p_sha is null or m.video_sha256 is distinct from p_sha or m.tiktok_state not in ('none','failed','cancelled') or (m.tiktok_state='failed' and m.publish_id is not null) then raise exception 'Video changed or already submitted. Refresh before approving.'; end if;
 if p_caption is null or length(p_caption)>2200 then raise exception 'Caption must be at most 2200 characters.'; end if;
 if not exists(select 1 from public.promo_workers where id=m.worker_id and enabled and tiktok_connected and account_hash=p_account and account_label is not null and last_seen_at>now()-interval '3 minutes') then raise exception 'Verify the connected TikTok account and wait for the PC to come online.'; end if;
 approval:=gen_random_uuid();
 update public.card_promo_media set tiktok_state='approved',caption=p_caption,approved_by=p_actor,approved_account=p_account,approval_id=approval,approved_at=now(),approval_expires_at=now()+interval '30 minutes',last_error=null,updated_at=now() where id=p_id;
 insert into public.agent_events(actor_id,title,detail) values(p_actor,'TikTok inbox upload approved',m.card_id||' · exact video '||left(p_sha,12)||'. Public posting is completed in TikTok.');
 return approval;
end $$;

create function public.claim_promo_upload(p_worker uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.card_promo_media%rowtype;
begin
 if exists(select 1 from public.agent_settings where paused) then return null; end if;
 select m1.* into m from public.card_promo_media m1 join public.promo_workers w on w.id=m1.worker_id
 join public.card_promos p on p.card_id=m1.card_id and p.revision=m1.revision
 where m1.worker_id=p_worker and m1.tiktok_state='approved' and m1.approval_expires_at>now() and m1.approved_account=w.account_hash and w.tiktok_connected and w.enabled
 and w.last_seen_at>now()-interval '3 minutes' and p.state not in ('dismissed','unavailable')
 order by m1.approved_at for update of m1 skip locked limit 1;
 if m.id is null then return null; end if;
 update public.card_promo_media set tiktok_state='sending',updated_at=now() where id=m.id returning * into m;
 return to_jsonb(m);
end $$;

create function public.record_promo_upload(p_worker uuid,p_id uuid,p_approval uuid,p_state text,p_publish text default null,p_error text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.card_promo_media%rowtype;
begin
 select * into m from public.card_promo_media where id=p_id for update;
 if m.id is null or m.worker_id is distinct from p_worker or m.approval_id is distinct from p_approval or m.tiktok_state not in ('sending','processing','uncertain') then raise exception 'Upload is not claimed by this worker.'; end if;
 if p_state is null or p_state not in ('processing','inbox','failed','uncertain') then raise exception 'Invalid TikTok state.'; end if;
 if m.publish_id is not null and p_publish is not null and m.publish_id<>p_publish then raise exception 'Cannot replace an existing TikTok upload.'; end if;
 if p_state in ('processing','inbox') and coalesce(m.publish_id,p_publish) is null then raise exception 'Missing TikTok upload reference.'; end if;
 update public.card_promo_media set tiktok_state=p_state,publish_id=coalesce(publish_id,p_publish),last_error=left(p_error,300),updated_at=now() where id=p_id;
end $$;
revoke all on function public.claim_promo_render(uuid),public.finish_promo_render(uuid,uuid,uuid,text,text,integer,text,text),public.approve_promo_upload(uuid,text,text,text,text),public.claim_promo_upload(uuid),public.record_promo_upload(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_promo_render(uuid),public.finish_promo_render(uuid,uuid,uuid,text,text,integer,text,text),public.approve_promo_upload(uuid,text,text,text,text),public.claim_promo_upload(uuid),public.record_promo_upload(uuid,uuid,uuid,text,text,text) to service_role;
