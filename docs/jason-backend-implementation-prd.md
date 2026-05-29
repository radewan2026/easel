# Jason Backend Implementation PRD

## Purpose

Turn the current high-fidelity Easel Paint & Sip prototype into a production-ready app by completing the Supabase, payment, email, and backend workflow pieces that the frontend cannot safely own.

The frontend already demonstrates the owner dashboard, event operations, customer account, membership credit checkout, private event pipeline, Email Center, Ask Easel surfaces, and demo seed data. Jason's work is to make those workflows real, durable, secure, and connected to production services.

## Current State

- Frontend app runs locally at `/admin`, `/account`, `/checkout/:slug`, `/private-events`, `/unsubscribe`, and related admin routes.
- Demo data can be seeded with `node scripts/seed-demo-data.mjs`.
- The seed currently skips `customer_memberships` and `membership_credit_redemptions` because those tables are missing in Supabase.
- Email UI exists, including template editor, campaign builder, suppression/preferences UI, testing/readiness views, and dry-run Supabase function scaffolds.
- Some schema fields expected by the frontend are missing from the live Supabase schema.
- Some workflows still use localStorage/demo fallbacks until backend tables and edge functions are deployed.

## Success Criteria

- Local/demo and production environments have matching migrations.
- Admin pages no longer produce missing-table or missing-column errors.
- Membership credits are backed by Supabase and Stripe, not browser state.
- Checkout can atomically create orders, attendees, credit redemptions, and seat-count changes.
- Email campaigns/templates/preferences persist in Supabase and send only through server-side workers.
- Private event requests can move from request to proposal to deposit to confirmed event.
- Customers can securely access only their own orders, memberships, gift cards, private requests, and email preferences.
- Admin permissions are enforced server-side, not only hidden in the UI.
- Frontend product analytics persist across browsers and can show page views, clicks, form starts, and funnel movement.

## Phase 1: Schema Alignment And Backend Hardening

### 1.1 Apply Membership Credit Ledger Migration

Use existing migration:

`supabase/migrations/20260523104500_membership_credit_ledger.sql`

This creates:

- `customer_memberships`
- `membership_credit_redemptions`
- `create_order_with_membership_credits(...)`

Jason should review and apply this migration in Supabase. After applying, rerun:

```bash
node scripts/seed-demo-data.mjs
```

Expected result:

- `customer_memberships` seeds successfully.
- `membership_credit_redemptions` seeds successfully.
- No 404/missing-table errors appear on admin pages.

### 1.2 Add Missing Columns Expected By Frontend

Live Supabase currently appears behind the frontend types. Add or confirm these columns:

```sql
alter table public.coupons
  add column if not exists source text not null default 'internal',
  add column if not exists external_platform_name text,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz;

alter table public.events
  add column if not exists is_archived boolean not null default false;
```

Recommended coupon constraint:

```sql
alter table public.coupons
  drop constraint if exists coupons_source_check;

alter table public.coupons
  add constraint coupons_source_check
  check (source in ('internal', 'groupon', 'other_platform'));
```

Acceptance criteria:

- `/admin/coupons` can create/edit coupons with source/platform/date fields.
- Coupon validation can use `valid_from` and `valid_to`.
- Event archive UI does not depend on missing `events.is_archived`.

### 1.3 Normalize Status Constraints To Match UI

Confirm check constraints match the statuses used in the product:

Private event requests should support:

- `submitted`
- `contacted`
- `proposal_sent`
- `confirmed`
- `declined`
- `cancelled`

Corporate accounts should support:

- `prospect`
- `active`
- `paused`
- `inactive`

Product orders should support:

- `pending`
- `processing`
- `shipped`
- `delivered`
- `cancelled`
- `refunded`

Email campaigns/sends should support the statuses in `docs/email-system-schema.sql`.

Acceptance criteria:

- Demo seed can run without downgrading statuses.
- Admin filters and badges map one-to-one to database values.

### 1.4 Add Updated-At Triggers

For all operational tables, ensure `updated_at` is present and maintained:

- `events`
- `orders`
- `coupons`
- `employees`
- `private_event_requests`
- `corporate_accounts`
- `customer_memberships`
- `email_templates`
- `email_campaigns`
- `email_automations`
- `customer_email_preferences`

Acceptance criteria:

- Admin detail drawers/timelines can show last changed dates reliably.

## Phase 2: RLS And Permission Model

### 2.1 Define Roles

Roles:

- `owner`
- `manager`
- `instructor`
- `marketing`
- `front_desk`

Recommended approach:

- Keep admin user records in `employees` or a dedicated `admin_users` table.
- Store role and permission JSON server-side.
- Add helper functions such as `is_admin()`, `has_admin_role(role text)`, and `current_customer_email()`.

### 2.2 RLS Requirements

Public read:

- Published, not-deleted events.
- Active products.
- Public galleries/blog/testimonials/FAQs.

Customer read:

- Own orders by email/user ID.
- Own attendees for own orders.
- Own gift cards by purchaser/recipient email.
- Own memberships and credit redemptions.
- Own email preferences.

Admin read/write:

- Role-scoped access to all operational tables.
- Instructors can view only assigned events, attendees, and their payroll/time records unless manager/owner.
- Marketing can manage campaigns, templates, coupons, segments, referrals, testimonials, and blog.
- Front desk can manage attendees, orders, gift cards, waitlist, and customer check-in.

Acceptance criteria:

- A customer cannot query another customer order by changing an email parameter.
- A non-admin cannot mutate admin tables.
- Admin UI permissions match actual Supabase enforcement.

## Phase 3: Memberships, Stripe Subscriptions, And Checkout Credits

### 3.1 Stripe Membership Products

Create Stripe products/prices for plans such as:

- Creative Duo: 2 credits/month.
- Studio Circle: 4 credits/month.
- Corporate/Custom: configurable.

Store in `customer_memberships`:

- `stripe_customer_id`
- `stripe_subscription_id`
- `plan_id`
- `plan_name`
- `monthly_price`
- `credits_per_cycle`
- `renewal_date`
- `status`

### 3.2 Stripe Webhooks

Implement webhook handler for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Webhook behavior:

- Create/update `customer_memberships`.
- Set `status` to `active`, `past_due`, `paused`, or `canceled`.
- Advance `renewal_date` on successful renewals.
- Do not erase redemption history.

### 3.3 Atomic Credit Checkout

The frontend already attempts to call:

`create_order_with_membership_credits(...)`

Jason should confirm the RPC:

- Locks the active membership row with `for update`.
- Calculates available credits for the current billing cycle.
- Creates `orders`.
- Creates `attendees`.
- Decrements event seats.
- Inserts `membership_credit_redemptions`.
- Rolls everything back if any step fails.

Acceptance criteria:

- Two simultaneous checkouts cannot spend the same credit twice.
- Credit usage is visible on `/account` and `/admin/memberships`.
- Checkout success shows how many credits were used and remaining balance.
- Failed membership payments block new credit redemption but preserve previous orders.

## Phase 4: Email System Backend

### 4.1 Apply Email Schema

Convert `docs/email-system-schema.sql` into a Supabase migration.

Tables:

- `email_templates`
- `email_automations`
- `email_campaigns`
- `email_sends`
- `email_events`
- `customer_email_preferences`
- `email_suppression_list`

Acceptance criteria:

- Email Center templates persist across browsers.
- Campaign drafts persist across sessions.
- Campaign draft tracking fields and generated UTM links persist through approval, worker pickup, and provider delivery.
- Suppressions and preferences are real database records, not localStorage.

### 4.2 Provider Setup

Recommended provider: Resend or Postmark.

Supabase secrets:

```bash
supabase secrets set EMAIL_PROVIDER=resend
supabase secrets set EMAIL_DRY_RUN=true
supabase secrets set RESEND_API_KEY=...
supabase secrets set EMAIL_FROM="Lake Tahoe Paint & Sip <hello@yourdomain.com>"
supabase secrets set EMAIL_TEST_RECIPIENT=owner@example.com
```

Domain setup:

- SPF
- DKIM
- DMARC
- verified sending domain
- branded unsubscribe/preference links

### 4.3 Deploy Edge Functions

Existing scaffolds:

- `supabase/functions/email-worker/index.ts`
- `supabase/functions/email-webhook/index.ts`
- `supabase/functions/email-test/index.ts`

Deploy:

```bash
supabase functions deploy email-worker
supabase functions deploy email-webhook
supabase functions deploy email-test
```

Worker requirements:

- Only server-side code can use provider API keys.
- Marketing sends must check preferences and suppression list.
- Transactional sends may bypass marketing opt-out but must respect hard suppressions where legally required.
- Owner approval required for marketing sends unless explicitly disabled by owner settings.
- Store provider message IDs in `email_sends`.

Webhook requirements:

- Ingest delivered, bounced, complained, opened, clicked, unsubscribed.
- Write raw payload to `email_events`.
- Update `email_sends.status`.
- Add bounces/complaints/unsubscribes to `email_suppression_list`.

Acceptance criteria:

- Test email can be sent in dry-run and real mode.
- Campaign queue creates `email_sends` rows.
- Bounces/complaints suppress future marketing sends.
- `/unsubscribe?email=...` writes to `customer_email_preferences`.

## Phase 5: Private Event Proposal Backend

### 5.1 Add Proposal Tables

Suggested tables:

```sql
create table if not exists public.private_event_proposals (
  id uuid primary key default gen_random_uuid(),
  private_request_id uuid not null references public.private_event_requests(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  subtotal_amount numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  deposit_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  valid_until date,
  contract_html text,
  stripe_payment_link text,
  signed_at timestamptz,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_event_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.private_event_proposals(id) on delete cascade,
  label text not null,
  description text,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(10, 2) not null default 0,
  total_price numeric(10, 2) not null default 0,
  sort_order integer not null default 0
);
```

### 5.2 Proposal Flow

Flow:

1. Customer submits `/private-events`.
2. Admin reviews in `/admin/private-requests`.
3. Admin creates proposal with line items, deposit, date, and package.
4. System sends proposal email with secure link.
5. Customer approves/signs and pays deposit.
6. Backend creates confirmed event or links to an existing event.
7. Request status becomes `confirmed`.

Acceptance criteria:

- Proposal status and deposit status are persisted.
- Admin can see next follow-up and proposal state.
- Deposit payment updates the request automatically.
- Confirmed private request can be converted into an event.

## Phase 6: Customer Account Backend

### 6.1 Authentication

Recommended options:

- Supabase Auth magic link.
- Email OTP.
- Stripe customer portal link for billing-only actions.

Customer account should load:

- orders
- attendees
- upcoming events
- past events
- gift cards purchased/received
- memberships
- credit redemptions
- private event requests
- email preferences

Acceptance criteria:

- `/account` is not powered by localStorage for production.
- Customer sees only their own records.
- Customer can update preferences and view membership credits.

## Phase 7: Admin Audit Trails And Object Activity

### 7.1 Add Activity Table

Suggested table:

```sql
create table if not exists public.admin_activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  object_type text not null,
  object_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Use for:

- event edits
- coupon creation
- email approvals/sends
- private request status changes
- proposal sends/approvals
- membership changes
- refund/cancellation actions
- Ask Easel confirmed actions

Acceptance criteria:

- Admin object detail views can show a timeline.
- Write/send/delete actions have audit records.

## Phase 7.5: Frontend Product Analytics

The frontend now captures a local analytics sample and exposes `/admin/analytics`. To make this production-ready, apply:

`docs/analytics-schema.sql`

Tracked events:

- `page_view`
- `ui_click`
- `form_start`
- `form_submit`
- `checkout_start`
- `checkout_abandoned`
- `checkout_submit`
- `checkout_complete`
- `checkout_error`
- `checkout_success_view`
- `calendar_add_click`
- `private_request_step_complete`
- `private_request_submit`
- `private_request_complete`
- `private_request_error`

Current owner UI:

- Date range filter: 7, 30, 90 days, or all local data.
- Audience filter: public site, customer account, admin app.
- Event-type filter for tracked event names.
- Source filter from UTM/referral attribution.
- Marketing Center campaign link builder for email, Instagram, Facebook, paid ads, QR codes, and partner/referral links.
- Saved campaign link library for reusable QR/social/partner tracking links, including an Analyze action that opens `/admin/analytics` with source, campaign, and range filters preselected. Analytics also compares saved links by visits, conversions, and conversion rate. Saved links can generate QR previews/downloads in demo. It is localStorage-backed in demo and should become a real marketing asset table in production.
- Abandoned checkout recovery table for guests who interact with event checkout and leave before booking. It shows event, captured name/email/phone when available, seat count, amount due, source/campaign, and a mailto recovery action in demo.
- CSV export for the currently filtered analytics rows.
- Funnel cards for event detail to checkout, checkout submit to complete, private page to form start, and private submit to received.
- Journey area grouping for checkout, events, private events, account, admin, shop, and other.
- Backend-aware data source: when `VITE_ANALYTICS_BACKEND_ENABLED=true`, `/admin/analytics` attempts to read from `analytics_events`; otherwise it uses local browser data. If the backend read fails, it falls back to local data and shows an owner-visible setup warning.

Production requirements:

- Enable frontend sync with `VITE_ANALYTICS_BACKEND_ENABLED=true` after the table and RLS policies exist.
- Allow anon/authenticated clients to insert analytics rows.
- Restrict analytics reads to admins/service role.
- Verify admin users can select from `analytics_events`; failed reads intentionally fall back to local analytics for demo safety.
- Add server-side rollups for filtered owner reports by date range, source, event type, user type, and journey area.
- Capture UTM parameters and attribute bookings/private requests to source.
- Preserve UTM parameters generated by Email Center campaign drafts and template CTA blocks.
- Store attribution on orders/private requests so conversion reports do not depend only on analytics events.
- Persist abandoned checkout opportunities server-side, dedupe by session/event/customer, and connect them to Email Center automation for recovery sends. Recovery emails must respect unsubscribe/suppression preferences and should stop if a later order completes for the same event/customer.
- Consider privacy controls and retention policy before production launch.

## Phase 7.6: Event Add-Ons And Inventory

The frontend now has a demo-safe event add-ons workflow:

- Admin event setup can attach active shop products as optional checkout add-ons for a specific event slug.
- Owners can override add-on price, max quantity, and whether the add-on should be suggested one-per-seat.
- Public event detail shows optional add-ons.
- Event checkout lets customers select quantities, includes add-ons in the order total, stores selected add-ons in checkout draft state, and attempts to create linked `product_orders` after the event order is created.
- Checkout analytics include `addOnSubtotal` and selected add-on details.

Current limitation: event add-on configuration is stored in localStorage for prototype/demo safety because the live schema does not yet have an event-product join table.

Recommended backend tables:

```sql
create table if not exists public.event_add_ons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  display_name text,
  price numeric(10,2) not null,
  max_quantity integer not null default 1,
  per_seat boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, product_id)
);

create table if not exists public.order_add_ons (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_add_on_id uuid references public.event_add_ons(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  created_at timestamptz not null default now()
);
```

Backend requirements:

- Validate add-on availability and inventory server-side during checkout.
- Decrement product stock atomically when an add-on is purchased.
- Include add-ons in order totals and receipts.
- Expose add-on units/revenue in event detail, reports, and dashboard low-inventory actions.
- Prevent customers from buying inactive add-ons or quantities above configured limits.

Acceptance criteria:

- `/admin/analytics` shows cross-device data, not only local browser sample data.
- Owners can see event detail view to checkout-start movement.
- Owners can see abandoned checkout opportunities with captured email, event, seats, amount due, and campaign attribution.
- Owners can see private-events page to form-start movement.
- Marketing campaigns can be attributed to checkout/private request outcomes.

## Phase 8: AI / Ask Easel Safety Backend

Ask Easel should be allowed to:

- summarize dashboard state
- draft emails
- draft private request follow-ups
- navigate to pages
- prepare actions

Ask Easel should not directly:

- send emails
- delete records
- refund payments
- alter payroll
- publish campaigns
- change pricing

Production requirement:

- Any write/send/delete/payment action must create a pending action record and require owner confirmation.

Suggested table:

```sql
create table if not exists public.assistant_action_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid,
  action_type text not null,
  object_type text,
  object_id uuid,
  proposed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
```

Acceptance criteria:

- Ask Easel can draft, but cannot silently send or mutate production data.
- Confirmed actions are auditable.

## Phase 9: Demo Data And Environment Separation

### 9.1 Seed Data

Current seed command:

```bash
node scripts/seed-demo-data.mjs
```

Jason should:

- keep demo seed out of production customer data
- make seed idempotent
- add environment guardrails
- ideally require `ALLOW_DEMO_SEED=true` for non-local targets

Acceptance criteria:

- Demo data can be reset safely in staging.
- Production cannot accidentally be overwritten with demo data.

### 9.2 Environment Variables

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_MEMBERSHIP_BACKEND_ENABLED=true`
- `VITE_EMAIL_PREFERENCES_BACKEND_ENABLED=true`
- `VITE_ANALYTICS_BACKEND_ENABLED=true`

Server/Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`
- `EMAIL_DRY_RUN`
- `RESEND_API_KEY` or provider equivalent
- `EMAIL_FROM`
- `EMAIL_TEST_RECIPIENT`

## Phase 10: QA Checklist

Jason should verify:

- `node scripts/seed-demo-data.mjs` completes without skipped membership tables.
- `/admin` dashboard loads without console errors.
- `/admin/events`, `/admin/private-requests`, `/admin/email`, `/admin/memberships`, `/admin/customers`, `/admin/shop/orders` show real seeded data.
- `/checkout/:slug?quantity=2` can redeem credits when signed in as a membership customer.
- `/account` shows orders, memberships, redemptions, gift cards, and preferences.
- `/unsubscribe?email=test@example.com` persists preference changes.
- Email worker can run in dry-run mode without sending.
- Email worker can send one test email after dry-run is disabled.
- Stripe webhook can create/update a membership.
- RLS blocks cross-customer reads.
- Admin roles are enforced by backend policies.

## Recommended Delivery Order

1. Apply schema alignment migration and membership ledger migration.
2. Add RLS policies and helper role functions.
3. Wire Stripe memberships and checkout credit RPC.
4. Apply email schema and deploy email functions in dry-run.
5. Add email provider credentials and webhook ingestion.
6. Add private event proposal/deposit backend.
7. Add customer auth/account persistence.
8. Add audit timeline and assistant action confirmation backend.
9. Run full QA with seeded staging data.

## Open Decisions

- Which email provider: Resend, Postmark, SendGrid, or Customer.io?
- Which customer auth method: magic link, OTP, password, or Stripe portal-first?
- Should memberships reset credits monthly based on renewal date only, or should unused credits roll over?
- Should private event deposits always use Stripe Payment Links, or should they use custom Checkout Sessions?
- Should the admin app use Supabase Auth roles, employee-table roles, or a hybrid?

## References

- Membership details: `docs/membership-credit-ledger.md`
- Existing membership migration: `supabase/migrations/20260523104500_membership_credit_ledger.sql`
- Email implementation notes: `docs/email-center-implementation.md`
- Email schema contract: `docs/email-system-schema.sql`
- Demo seed: `scripts/seed-demo-data.mjs`
