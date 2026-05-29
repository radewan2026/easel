-- Analytics system schema
-- Tracks page views, clicks, conversions, and provides daily rollups

-- 1. Analytics events (one row per tracked action)
create table if not exists analytics_events (
  id uuid primary key,
  event_name text not null,
  path text not null default '',
  title text,
  anonymous_id text not null,
  session_id text not null,
  user_type text not null check (user_type in ('public', 'customer', 'admin')),
  user_email text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Daily rollups (pre-aggregated metrics for fast dashboard loading)
create table if not exists analytics_daily_rollups (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  metric_name text not null,
  dimension text not null default 'all',
  dimension_value text not null default 'all',
  count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (date, metric_name, dimension, dimension_value)
);

-- 3. Attribution conversions (links a conversion to the source that drove it)
create table if not exists analytics_attribution (
  id uuid primary key default gen_random_uuid(),
  conversion_event_id uuid references analytics_events(id),
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  landing_path text,
  referrer text,
  conversion_type text not null check (conversion_type in ('checkout', 'private_request', 'newsletter', 'gift_card_purchase')),
  order_id uuid,
  attributed_revenue numeric(10,2) not null default 0,
  converted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists analytics_events_occurred_at_idx on analytics_events(occurred_at desc);
create index if not exists analytics_events_event_name_idx on analytics_events(event_name);
create index if not exists analytics_events_anonymous_id_idx on analytics_events(anonymous_id);
create index if not exists analytics_events_session_id_idx on analytics_events(session_id);
create index if not exists analytics_events_user_type_idx on analytics_events(user_type);
create index if not exists analytics_events_user_email_idx on analytics_events(user_email);
create index if not exists analytics_daily_rollups_date_idx on analytics_daily_rollups(date desc);
create index if not exists analytics_daily_rollups_metric_idx on analytics_daily_rollups(metric_name);
create index if not exists analytics_attribution_source_idx on analytics_attribution(source);
create index if not exists analytics_attribution_campaign_idx on analytics_attribution(campaign);
create index if not exists analytics_attribution_conversion_type_idx on analytics_attribution(conversion_type);

-- RLS
alter table analytics_events enable row level security;
alter table analytics_daily_rollups enable row level security;
alter table analytics_attribution enable row level security;

create policy "analytics_events_select" on analytics_events for select using (is_admin());
create policy "analytics_events_insert" on analytics_events for insert with check (true);

create policy "analytics_daily_rollups_select" on analytics_daily_rollups for select using (is_admin());

create policy "analytics_attribution_select" on analytics_attribution for select using (is_admin());
