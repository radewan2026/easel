-- Membership credit ledger and atomic checkout support.
-- This migration is intentionally idempotent so it can be applied to an
-- existing demo database without clobbering data.

create extension if not exists pgcrypto;

create table if not exists public.customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  customer_name text,
  plan_id text,
  plan_name text not null,
  monthly_price numeric(10, 2) not null default 0,
  credits_per_cycle integer not null default 0 check (credits_per_cycle >= 0),
  renewal_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'paused', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_memberships
  add column if not exists customer_name text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.membership_credit_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_membership_id uuid references public.customer_memberships(id) on delete set null,
  customer_email text not null,
  event_id uuid not null references public.events(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  credits_used integer not null check (credits_used > 0),
  amount_covered numeric(10, 2) not null default 0,
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.membership_credit_redemptions
  add column if not exists customer_membership_id uuid references public.customer_memberships(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists customer_memberships_subscription_uidx
  on public.customer_memberships (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists customer_memberships_email_idx
  on public.customer_memberships (lower(customer_email));

create index if not exists customer_memberships_status_idx
  on public.customer_memberships (status);

create index if not exists membership_credit_redemptions_email_idx
  on public.membership_credit_redemptions (lower(customer_email));

create index if not exists membership_credit_redemptions_membership_idx
  on public.membership_credit_redemptions (customer_membership_id);

create index if not exists membership_credit_redemptions_order_idx
  on public.membership_credit_redemptions (order_id);

create or replace function public.touch_customer_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_customer_memberships_updated_at on public.customer_memberships;
create trigger touch_customer_memberships_updated_at
before update on public.customer_memberships
for each row
execute function public.touch_customer_memberships_updated_at();

create or replace function public.create_order_with_membership_credits(
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
set search_path = public
as $$
declare
  v_customer_email text := lower(trim(coalesce(p_customer_email, p_purchaser_email)));
  v_membership public.customer_memberships%rowtype;
  v_order public.orders%rowtype;
  v_redemption public.membership_credit_redemptions%rowtype;
  v_attendees jsonb := '[]'::jsonb;
  v_cycle_start timestamptz;
  v_credits_redeemed integer := 0;
  v_credits_available integer := 0;
begin
  if coalesce(p_total_seats, 0) <= 0 then
    raise exception 'Total seats must be greater than zero.';
  end if;

  if coalesce(p_membership_credits_used, 0) < 0 then
    raise exception 'Membership credits used cannot be negative.';
  end if;

  if coalesce(p_membership_credits_used, 0) > 0 then
    select *
    into v_membership
    from public.customer_memberships
    where lower(customer_email) = v_customer_email
      and status = 'active'
    order by renewal_date asc
    limit 1
    for update;

    if not found then
      raise exception 'No active membership found for %. Sign in with the membership email or choose another payment method.', v_customer_email;
    end if;

    v_cycle_start := v_membership.renewal_date - interval '1 month';

    select coalesce(sum(credits_used), 0)::integer
    into v_credits_redeemed
    from public.membership_credit_redemptions
    where customer_membership_id = v_membership.id
      and redeemed_at >= v_cycle_start
      and redeemed_at < v_membership.renewal_date;

    v_credits_available := greatest(v_membership.credits_per_cycle - v_credits_redeemed, 0);

    if p_membership_credits_used > v_credits_available then
      raise exception 'Not enough membership credits available. Requested %, available %.',
        p_membership_credits_used,
        v_credits_available;
    end if;
  end if;

  insert into public.orders (
    event_id,
    purchaser_name,
    purchaser_email,
    purchaser_phone,
    total_seats,
    subtotal_amount,
    discount_amount,
    total_amount,
    coupon_id,
    status
  )
  values (
    p_event_id,
    p_purchaser_name,
    p_purchaser_email,
    p_purchaser_phone,
    p_total_seats,
    p_subtotal_amount,
    p_discount_amount,
    p_total_amount,
    p_coupon_id,
    coalesce(p_status, 'pending')
  )
  returning * into v_order;

  insert into public.attendees (
    order_id,
    full_name,
    email,
    notes
  )
  select
    v_order.id,
    coalesce(attendee->>'fullName', attendee->>'full_name', ''),
    nullif(coalesce(attendee->>'email', ''), ''),
    nullif(coalesce(attendee->>'notes', ''), '')
  from jsonb_array_elements(coalesce(p_attendees, '[]'::jsonb)) as attendee
  where coalesce(attendee->>'fullName', attendee->>'full_name', '') <> '';

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
  into v_attendees
  from public.attendees a
  where a.order_id = v_order.id;

  update public.events
  set
    seats_available = case
      when seats_available is null then null
      else greatest(seats_available - p_total_seats, 0)
    end,
    updated_at = now()
  where id = p_event_id;

  if coalesce(p_membership_credits_used, 0) > 0 then
    insert into public.membership_credit_redemptions (
      customer_membership_id,
      customer_email,
      event_id,
      order_id,
      credits_used,
      amount_covered,
      redeemed_at
    )
    values (
      v_membership.id,
      v_customer_email,
      p_event_id,
      v_order.id,
      p_membership_credits_used,
      coalesce(p_membership_credit_value, 0),
      now()
    )
    returning * into v_redemption;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'attendees', v_attendees,
    'membershipRedemption', case
      when v_redemption.id is null then null
      else to_jsonb(v_redemption)
    end
  );
end;
$$;

grant execute on function public.create_order_with_membership_credits(
  uuid,
  text,
  text,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text,
  uuid,
  jsonb,
  text,
  integer,
  numeric
) to anon, authenticated, service_role;
