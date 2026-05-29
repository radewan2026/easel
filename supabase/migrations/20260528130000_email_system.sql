-- Email system schema
-- Additive: existing `email_broadcasts` table remains for backward compatibility.

-- 1. Email templates
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null check (template_type in ('transactional', 'marketing', 'automation')),
  trigger_name text not null default 'manual',
  subject text not null,
  preview_text text,
  html_body text not null,
  text_body text,
  merge_fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Email automations (rules that trigger sends)
create table if not exists email_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_name text not null,
  audience_key text not null,
  template_id uuid references email_templates(id),
  status text not null default 'draft' check (status in ('active', 'paused', 'draft')),
  delay_minutes integer not null default 0,
  require_owner_approval boolean not null default false,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Email campaigns (owner-created sends)
create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  audience_key text not null,
  template_id uuid references email_templates(id),
  body_snapshot text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'queued', 'sending', 'sent', 'cancelled')),
  recipient_count integer not null default 0,
  scheduled_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Customer email preferences (opt-in/opt-out per category)
create table if not exists customer_email_preferences (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  transactional_enabled boolean not null default true,
  marketing_enabled boolean not null default true,
  private_event_updates_enabled boolean not null default true,
  membership_updates_enabled boolean not null default true,
  unsubscribed_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_email)
);

-- 5. Suppression list (bounces, complaints, manual blocks)
create table if not exists email_suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  provider_event_id text,
  notes text,
  created_at timestamptz not null default now(),
  unique (email, reason)
);

-- 6. Individual email sends (one row per recipient per send)
create table if not exists email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references email_campaigns(id),
  automation_id uuid references email_automations(id),
  template_id uuid references email_templates(id),
  recipient_email text not null,
  recipient_name text,
  subject_snapshot text not null,
  body_snapshot text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed')),
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now()
);

-- 7. Email events (webhook event log)
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  send_id uuid references email_sends(id),
  provider text not null,
  provider_event_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists email_templates_type_idx on email_templates(template_type);
create index if not exists email_automations_status_idx on email_automations(status);
create index if not exists email_campaigns_status_idx on email_campaigns(status);
create index if not exists email_sends_recipient_idx on email_sends(lower(recipient_email));
create index if not exists email_sends_provider_message_idx on email_sends(provider_message_id);
create index if not exists email_suppression_email_idx on email_suppression_list(lower(email));
create index if not exists customer_email_preferences_email_idx on customer_email_preferences(lower(customer_email));
create index if not exists email_sends_status_idx on email_sends(status);
create index if not exists email_events_send_id_idx on email_events(send_id);

-- RLS
alter table email_templates enable row level security;
alter table email_automations enable row level security;
alter table email_campaigns enable row level security;
alter table customer_email_preferences enable row level security;
alter table email_suppression_list enable row level security;
alter table email_sends enable row level security;
alter table email_events enable row level security;

create policy "email_templates_select" on email_templates for select using (is_admin());
create policy "email_templates_insert" on email_templates for insert with check (is_admin());
create policy "email_templates_update" on email_templates for update using (is_admin());

create policy "email_automations_select" on email_automations for select using (is_admin());
create policy "email_automations_insert" on email_automations for insert with check (is_admin());
create policy "email_automations_update" on email_automations for update using (is_admin());

create policy "email_campaigns_select" on email_campaigns for select using (is_admin());
create policy "email_campaigns_insert" on email_campaigns for insert with check (is_admin());
create policy "email_campaigns_update" on email_campaigns for update using (is_admin());

create policy "customer_email_preferences_select" on customer_email_preferences for select using (true);
create policy "customer_email_preferences_insert" on customer_email_preferences for insert with check (true);
create policy "customer_email_preferences_update" on customer_email_preferences for update using (true);

create policy "email_suppression_list_select" on email_suppression_list for select using (is_admin());
create policy "email_suppression_list_insert" on email_suppression_list for insert with check (true);
create policy "email_suppression_list_delete" on email_suppression_list for delete using (is_admin());

create policy "email_sends_select" on email_sends for select using (is_admin());
create policy "email_sends_insert" on email_sends for insert with check (is_admin());
create policy "email_sends_update" on email_sends for update using (is_admin());

create policy "email_events_select" on email_events for select using (is_admin());
create policy "email_events_insert" on email_events for insert with check (true);

-- Seed default templates
insert into email_templates (name, template_type, trigger_name, subject, preview_text, html_body) values
(
  'Order Confirmation',
  'transactional',
  'order_paid',
  'Your seats are confirmed for {{event_title}}',
  'Ticket details, event time, and what to bring.',
  '<h2>Thanks for booking {{event_title}}!</h2><p>Your seats are confirmed for {{event_datetime}}.</p><p>Location: {{venue_name}}<br/>Address: {{venue_address}}</p><p>Please arrive 10 minutes early. We provide all materials — just bring yourself and your creativity!</p>'
),
(
  '48-Hour Event Reminder',
  'automation',
  'event_48h_before',
  'Reminder: {{event_title}} is coming up',
  'Parking, arrival time, and guest details.',
  '<h2>We are excited to paint with you!</h2><p>This is a friendly reminder that {{event_title}} is coming up on {{event_datetime}}.</p><p>Please arrive 10 minutes early to get settled.</p><p>See you soon!</p>'
),
(
  'Private Request Follow-Up',
  'automation',
  'private_request_submitted',
  'We received your private event request',
  'Next steps for your private paint party.',
  '<h2>Thanks for reaching out!</h2><p>We have received your private event request. Our team will review your guest count, timing, and package needs and get back to you within 1-2 business days.</p>'
),
(
  'Unused Gift Card Reminder',
  'marketing',
  'gift_card_30d',
  'Your paint night gift card is waiting',
  'Pick an upcoming class and use your gift card.',
  '<h2>You still have a gift card available!</h2><p>Here are a few upcoming classes we think you will love:</p><p><a href="{{events_url}}">Browse upcoming events</a></p>'
),
(
  'Abandoned Checkout Recovery',
  'automation',
  'checkout_abandoned_60m',
  'Still thinking about {{event_title}}?',
  'Your seats are not reserved yet.',
  '<h2>Hi {{first_name}},</h2><p>You started booking {{event_title}} but didn''t finish checkout. Your seats are not reserved yet.</p><p><a href="{{checkout_url}}">Return to checkout</a></p>'
),
(
  'Membership Credit Reminder',
  'automation',
  'credits_unused_before_renewal',
  'You still have {{credit_count}} paint night credit{{plural}}',
  'Use your membership credits before your next renewal.',
  '<h2>Your membership includes credits!</h2><p>You still have {{credit_count}} credit{{plural}} available to use before your next renewal. Browse upcoming events and apply your credits at checkout.</p><p><a href="{{events_url}}">Book an event</a></p>'
);
