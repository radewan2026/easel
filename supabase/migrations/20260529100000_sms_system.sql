-- SMS notification system schema

-- 1. SMS templates
create table if not exists sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null check (template_type in ('transactional', 'marketing', 'automation')),
  trigger_name text not null default 'manual',
  body text not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Customer SMS preferences
create table if not exists customer_sms_preferences (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  transactional_enabled boolean not null default true,
  marketing_enabled boolean not null default true,
  appointment_reminders_enabled boolean not null default true,
  opted_out_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_phone)
);

-- 3. SMS suppression list
create table if not exists sms_suppression_list (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  reason text not null check (reason in ('opt_out', 'bounce', 'complaint', 'manual')),
  provider_event_id text,
  notes text,
  created_at timestamptz not null default now(),
  unique (phone, reason)
);

-- 4. Individual SMS messages (one row per recipient per send)
create table if not exists sms_messages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references sms_templates(id),
  campaign_id uuid,
  recipient_phone text not null,
  recipient_name text,
  body_snapshot text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'bounced', 'opted_out')),
  provider text not null default 'twilio',
  provider_message_id text,
  provider_status text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_reason text,
  from_number text,
  created_at timestamptz not null default now()
);

-- 5. SMS events (webhook event log)
create table if not exists sms_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references sms_messages(id),
  provider text not null,
  provider_event_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists sms_templates_type_idx on sms_templates(template_type);
create index if not exists sms_messages_recipient_idx on sms_messages(lower(recipient_phone));
create index if not exists sms_messages_provider_message_idx on sms_messages(provider_message_id);
create index if not exists sms_messages_status_idx on sms_messages(status);
create index if not exists sms_suppression_phone_idx on sms_suppression_list(lower(phone));
create index if not exists sms_events_message_id_idx on sms_events(message_id);

-- RLS
alter table sms_templates enable row level security;
alter table customer_sms_preferences enable row level security;
alter table sms_suppression_list enable row level security;
alter table sms_messages enable row level security;
alter table sms_events enable row level security;

create policy "sms_templates_select" on sms_templates for select using (is_admin());
create policy "sms_templates_insert" on sms_templates for insert with check (is_admin());
create policy "sms_templates_update" on sms_templates for update using (is_admin());
create policy "sms_templates_delete" on sms_templates for delete using (is_admin());

create policy "customer_sms_preferences_select" on customer_sms_preferences for select using (true);
create policy "customer_sms_preferences_insert" on customer_sms_preferences for insert with check (true);
create policy "customer_sms_preferences_update" on customer_sms_preferences for update using (true);

create policy "sms_suppression_list_select" on sms_suppression_list for select using (is_admin());
create policy "sms_suppression_list_insert" on sms_suppression_list for insert with check (true);
create policy "sms_suppression_list_delete" on sms_suppression_list for delete using (is_admin());

create policy "sms_messages_select" on sms_messages for select using (is_admin());
create policy "sms_messages_insert" on sms_messages for insert with check (is_admin());
create policy "sms_messages_update" on sms_messages for update using (is_admin());

create policy "sms_events_select" on sms_events for select using (is_admin());
create policy "sms_events_insert" on sms_events for insert with check (true);

-- Seed default SMS templates
insert into sms_templates (name, template_type, trigger_name, body) values
(
  'Order Confirmation',
  'transactional',
  'order_paid',
  'Thanks for booking {{event_title}}! Your {{ticket_count}} seat(s) are confirmed for {{event_datetime}}. See you at {{venue_name}}!'
),
(
  'Event Reminder (24h)',
  'automation',
  'event_24h_before',
  'Reminder: {{event_title}} is TOMORROW at {{event_datetime}}. Arrive 10min early. All materials provided! See you at {{venue_name}}.'
),
(
  'Private Request Confirmation',
  'automation',
  'private_request_submitted',
  'We received your private event request for {{guest_count}} guests. Our team will review and get back to you within 1-2 business days.'
),
(
  'Gift Card Reminder',
  'marketing',
  'gift_card_30d',
  'You still have a gift card balance of {{gift_card_balance}}. Browse upcoming events and use it before it expires! {{events_url}}'
),
(
  'Abandoned Checkout',
  'automation',
  'checkout_abandoned_60m',
  'You started booking {{event_title}} but didn''t finish. Your seats are not reserved yet. Complete your booking here: {{checkout_url}}'
);
