create table public.agent_settings (
  id boolean primary key default true check(id),
  paused boolean not null default false,
  spend_limit_pence integer not null default 0 check(spend_limit_pence=0),
  updated_at timestamptz not null default now()
);
insert into public.agent_settings(id) values(true);
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check(trigger_source in ('manual','daily')),
  status text not null check(status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}',
  error text
);
create table public.agent_actions (
  id text primary key,
  kind text not null check(kind in ('withdraw_listing','review_listing','review_payment')),
  title text not null,
  detail text not null,
  severity text not null check(severity in ('attention','warning')),
  card_id text,
  order_id uuid,
  snapshot jsonb not null default '{}',
  state text not null default 'pending' check(state in ('pending','executed','dismissed','resolved','stale')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  decided_at timestamptz,
  actor_id text,
  outcome text
);
create index agent_actions_state_idx on public.agent_actions(state,created_at desc);
create index agent_runs_started_idx on public.agent_runs(started_at desc);
create table public.agent_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id text,
  title text not null,
  detail text not null
);
alter table public.agent_events enable row level security;
alter table public.agent_settings enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_actions enable row level security;
revoke all on public.agent_settings,public.agent_runs,public.agent_actions,public.agent_events from public,anon,authenticated;
grant all on public.agent_settings,public.agent_runs,public.agent_actions,public.agent_events to service_role;

create function public.start_agent_run(p_source text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare run_id uuid; settings public.agent_settings%rowtype;
begin
  select * into settings from public.agent_settings where id for update;
  if settings.paused then return null; end if;
  if exists(select 1 from public.agent_runs where started_at>clock_timestamp()-interval '10 seconds'
    or (status='running' and started_at>clock_timestamp()-interval '5 minutes')) then return null; end if;
  update public.agent_runs set status='failed',finished_at=clock_timestamp(),error='Interrupted check. Run again to refresh findings.' where status='running';
  insert into public.agent_runs(trigger_source,status) values(p_source,'running') returning id into run_id;
  return run_id;
end $$;

create function public.finish_agent_run(p_id uuid,p_summary jsonb,p_actions jsonb) returns void
language plpgsql security invoker set search_path=public as $$
begin
  perform id from public.agent_runs where id=p_id and status='running' for update;
  if not found then raise exception 'Run is no longer active'; end if;
  insert into public.agent_actions(id,kind,title,detail,severity,card_id,order_id,snapshot)
  select a->>'id',a->>'kind',a->>'title',a->>'detail',a->>'severity',a->>'card_id',(a->>'order_id')::uuid,coalesce(a->'snapshot','{}')
    from jsonb_array_elements(p_actions) a on conflict(id) do update set state='pending',expires_at=now()+interval '24 hours',decided_at=null,outcome=null
      where agent_actions.state in ('stale','resolved') or (agent_actions.state='pending' and agent_actions.expires_at<=now());
  update public.agent_actions set state='resolved',decided_at=clock_timestamp(),outcome='The latest complete check no longer found this issue.'
    where state='pending' and id not in (select a->>'id' from jsonb_array_elements(p_actions) a);
  update public.agent_runs set status='completed',finished_at=clock_timestamp(),summary=p_summary where id=p_id;
end $$;

create function public.decide_agent_action(p_id text,p_decision text,p_actor text) returns text
language plpgsql security invoker set search_path=public as $$
declare a public.agent_actions%rowtype; c public."Card"%rowtype;
begin
  select * into a from public.agent_actions where id=p_id for update;
  if not found then raise exception 'Action not found'; end if;
  if a.state<>'pending' then return a.state; end if;
  if p_decision='dismiss' then
    update public.agent_actions set state='dismissed',decided_at=now(),actor_id=p_actor,outcome='Dismissed by the owner.' where id=p_id;
    insert into public.agent_events(actor_id,title,detail) values(p_actor,'Review dismissed',a.title);
    return 'dismissed';
  end if;
  if p_decision<>'approve' or a.kind<>'withdraw_listing' then raise exception 'This action requires manual review'; end if;
  if a.expires_at<=clock_timestamp() then
    update public.agent_actions set state='stale',decided_at=now(),outcome='Approval expired. Run checks again.' where id=p_id;
    insert into public.agent_events(actor_id,title,detail) values(p_actor,'Approval expired',a.title);
    return 'stale';
  end if;
  select * into c from public."Card" where id=a.card_id for update;
  if not found or c.price is distinct from (a.snapshot->>'price')::integer
    or c.available is distinct from (a.snapshot->>'available')::boolean
    or c."updatedAt" is distinct from (a.snapshot->>'updatedAt')::timestamp then
    update public.agent_actions set state='stale',decided_at=now(),outcome='Listing changed. Run checks again before approving.' where id=p_id;
    insert into public.agent_events(actor_id,title,detail) values(p_actor,'Approval stopped',a.title||' — listing changed.');
    return 'stale';
  end if;
  perform public.edit_inventory_card(a.card_id,'{"available":false}'::jsonb,false);
  insert into public.agent_events(actor_id,title,detail) values(p_actor,'Listing hidden with approval',a.title);
  update public.agent_actions set state='executed',decided_at=now(),actor_id=p_actor,outcome='Listing hidden from the shop. No price or stock purchase was made.' where id=p_id;
  return 'executed';
end $$;
revoke all on function public.start_agent_run(text),public.finish_agent_run(uuid,jsonb,jsonb),public.decide_agent_action(text,text,text) from public,anon,authenticated;
grant execute on function public.start_agent_run(text),public.finish_agent_run(uuid,jsonb,jsonb),public.decide_agent_action(text,text,text) to service_role;
