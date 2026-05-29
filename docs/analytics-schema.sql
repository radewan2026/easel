-- Frontend product analytics for owner-facing reporting.
-- Apply in Supabase when VITE_ANALYTICS_BACKEND_ENABLED=true is ready.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  path text not null,
  title text,
  anonymous_id text not null,
  session_id text not null,
  user_type text not null check (user_type in ('public', 'customer', 'admin')),
  user_email text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_path_idx
  on public.analytics_events (path);

create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id);

create index if not exists analytics_events_properties_gin_idx
  on public.analytics_events using gin (properties);

alter table public.analytics_events enable row level security;

drop policy if exists "Allow frontend analytics inserts" on public.analytics_events;
create policy "Allow frontend analytics inserts"
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow admins to read analytics" on public.analytics_events;
create policy "Allow admins to read analytics"
  on public.analytics_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users admin
      where admin.id = auth.uid()
    )
  );

-- Optional helper view for simple dashboard rollups.
create or replace view public.analytics_daily_summary as
select
  date_trunc('day', occurred_at) as day,
  event_name,
  user_type,
  count(*) as events,
  count(distinct anonymous_id) as visitors,
  count(distinct session_id) as sessions
from public.analytics_events
group by 1, 2, 3;
