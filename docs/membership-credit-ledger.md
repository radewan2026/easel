# Membership Credit Ledger

Phase 2 moves membership credits away from browser-only state. The app now reads credits from backend tables when they exist and falls back to a demo ledger only for local testing.

The production migration now lives at:

`supabase/migrations/20260523104500_membership_credit_ledger.sql`

Apply that migration before enabling `VITE_MEMBERSHIP_BACKEND_ENABLED=true`.

Production tables:

```sql
create table customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  customer_name text,
  plan_id text,
  plan_name text not null,
  monthly_price numeric not null default 0,
  credits_per_cycle integer not null default 0,
  renewal_date timestamptz not null,
  status text not null check (status in ('active', 'paused', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table membership_credit_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_membership_id uuid references customer_memberships(id),
  customer_email text not null,
  event_id uuid not null references events(id),
  order_id uuid not null references orders(id),
  credits_used integer not null check (credits_used > 0),
  amount_covered numeric not null default 0,
  redeemed_at timestamptz not null default now()
);

create index customer_memberships_email_idx on customer_memberships (lower(customer_email));
create index membership_credit_redemptions_email_idx on membership_credit_redemptions (lower(customer_email));
```

The frontend now prefers a `create_order_with_membership_credits` RPC whenever membership credits are used. If that RPC is not installed, local development falls back to the older client-side order plus demo-ledger redemption path.

RPC contract:

```sql
create or replace function create_order_with_membership_credits(
  p_event_id uuid,
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_total_seats integer,
  p_subtotal_amount numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_status text,
  p_coupon_id uuid,
  p_attendees jsonb,
  p_customer_email text,
  p_membership_credits_used integer,
  p_membership_credit_value numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order orders;
  v_redemption membership_credit_redemptions;
begin
  -- See the migration for the installed implementation.
end;
$$;
```

Keep the credit check and order creation inside the same transaction so credits cannot be double-spent during concurrent checkouts.
