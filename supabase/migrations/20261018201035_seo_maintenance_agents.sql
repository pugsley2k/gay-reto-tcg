-- New, isolated tables keep old inventory checks compatible during rollout.
create table public.web_page_metadata (
  path text primary key check (path in ('/','/shop','/delivery','/returns','/contact')),
  title text check (title is null or char_length(title) between 1 and 90),
  description text check (description is null or char_length(description) between 1 and 220),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  check ((title is null) = (description is null))
);
insert into public.web_page_metadata(path) values ('/'),('/shop'),('/delivery'),('/returns'),('/contact');
create table public.web_agent_actions (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  scope text not null check (scope in ('seo','maintenance')),
  kind text not null check (kind in ('seo_metadata','web_review')),
  path text not null,
  title text not null,
  detail text not null,
  severity text not null check (severity in ('attention','warning')),
  snapshot jsonb not null default '{}',
  state text not null default 'pending' check (state in ('pending','executed','dismissed','resolved','stale')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  decided_at timestamptz,
  actor_id text,
  outcome text
);
create index web_agent_actions_state_idx on public.web_agent_actions(state,created_at desc);
alter table public.web_page_metadata enable row level security;
alter table public.web_agent_actions enable row level security;
revoke all on public.web_page_metadata,public.web_agent_actions from public,anon,authenticated;
grant all on public.web_page_metadata,public.web_agent_actions to service_role;

create function public.save_web_agent_findings(p_run uuid,p_actions jsonb,p_checked jsonb) returns void
language plpgsql security invoker set search_path=public as $$
begin
  perform id from public.agent_runs where id=p_run and status='running' for update;
  if not found then raise exception 'Run is no longer active'; end if;
  insert into public.web_agent_actions(id,scope,kind,path,title,detail,severity,snapshot)
    select a->>'id',a->>'scope',a->>'kind',a->>'path',a->>'title',a->>'detail',a->>'severity',a->'snapshot'
    from jsonb_array_elements(p_actions) a
    on conflict(id) do update set state='pending',expires_at=now()+interval '24 hours',decided_at=null,outcome=null,actor_id=null
      where web_agent_actions.state in ('resolved','stale') or (web_agent_actions.state='pending' and web_agent_actions.expires_at<=now());
  update public.web_agent_actions set state='resolved',decided_at=now(),outcome='A complete check of this page no longer found this issue.'
    where state='pending' and (scope||':'||path) in (select jsonb_array_elements_text(p_checked))
      and id not in (select a->>'id' from jsonb_array_elements(p_actions) a);
end $$;

create function public.decide_web_agent_action(p_id text,p_decision text,p_actor text) returns text
language plpgsql security invoker set search_path=public as $$
declare a public.web_agent_actions%rowtype; doc public.web_page_metadata%rowtype;
begin
  select * into a from public.web_agent_actions where id=p_id for update;
  if not found then raise exception 'Action not found'; end if;
  if a.state<>'pending' then return a.state; end if;
  if p_decision='dismiss' then
    update public.web_agent_actions set state='dismissed',decided_at=now(),actor_id=p_actor,outcome='Dismissed by the owner.' where id=p_id;
    insert into public.agent_events(actor_id,title,detail) values(p_actor,'Website review dismissed',a.title);
    return 'dismissed';
  end if;
  if p_decision<>'approve' or a.kind<>'seo_metadata' or a.scope<>'seo' then raise exception 'This finding requires a reviewed code change'; end if;
  select * into doc from public.web_page_metadata where path=a.path for update;
  if not found or a.expires_at<=clock_timestamp() or doc.revision is distinct from (a.snapshot->>'revision')::integer then
    update public.web_agent_actions set state='stale',decided_at=now(),outcome='Approval expired or metadata changed. Run checks again.' where id=p_id;
    return 'stale';
  end if;
  if a.snapshot#>>'{after,canonical}' is distinct from ('https://www.gayretrotcg.com'||a.path)
    or coalesce(char_length(a.snapshot#>>'{after,title}'),0) not between 1 and 90
    or coalesce(char_length(a.snapshot#>>'{after,description}'),0) not between 1 and 220 then raise exception 'Invalid metadata proposal'; end if;
  update public.web_page_metadata set title=a.snapshot#>>'{after,title}',description=a.snapshot#>>'{after,description}',revision=revision+1,updated_at=now() where path=a.path;
  update public.web_agent_actions set state='executed',decided_at=now(),actor_id=p_actor,outcome='Exact search and social metadata published with owner approval.' where id=p_id;
  insert into public.agent_events(actor_id,title,detail) values(p_actor,'SEO metadata approved',a.path||' — '||(a.snapshot#>>'{after,title}'));
  return 'executed';
end $$;

create function public.restore_page_metadata(p_path text,p_revision integer,p_actor text) returns text
language plpgsql security invoker set search_path=public as $$
declare doc public.web_page_metadata%rowtype;
begin
  select * into doc from public.web_page_metadata where path=p_path for update;
  if not found or doc.revision<>p_revision then return 'stale'; end if;
  if doc.title is null then return 'unchanged'; end if;
  update public.web_page_metadata set title=null,description=null,revision=revision+1,updated_at=now() where path=p_path;
  insert into public.agent_events(actor_id,title,detail) values(p_actor,'Original SEO metadata restored',p_path||' — previous title: '||doc.title);
  return 'restored';
end $$;
revoke all on function public.save_web_agent_findings(uuid,jsonb,jsonb),public.decide_web_agent_action(text,text,text),public.restore_page_metadata(text,integer,text) from public,anon,authenticated;
grant execute on function public.save_web_agent_findings(uuid,jsonb,jsonb),public.decide_web_agent_action(text,text,text),public.restore_page_metadata(text,integer,text) to service_role;
