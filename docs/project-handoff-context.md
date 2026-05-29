# Project Handoff Context

## What This Branch Is

This branch is a high-fidelity prototype and implementation pass for the Easel Paint & Sip owner/admin system plus customer-facing account, checkout, private event, membership, and email workflows.

Branch:

`codex-owner-dashboard-briefing`

Draft PR:

`https://github.com/al3542/paint-and-sip-main/pull/1`

Local app:

`http://127.0.0.1:5173`

## Most Important Files

- `docs/jason-backend-implementation-prd.md`: backend/Supabase/Stripe/email PRD for Jason.
- `docs/admin-product-roadmap-prd.md`: broader admin product roadmap and UX simplification notes.
- `docs/owner-dashboard-prd.md`: owner dashboard PRD.
- `docs/email-center-implementation.md`: email center implementation notes and backend handoff.
- `docs/email-system-schema.sql`: proposed email system schema.
- `docs/analytics-schema.sql`: proposed frontend product analytics schema.
- `docs/membership-credit-ledger.md`: membership credit ledger notes.
- `supabase/migrations/20260523104500_membership_credit_ledger.sql`: membership credit tables and checkout RPC migration.
- `scripts/seed-demo-data.mjs`: idempotent demo seed for events, orders, attendees, private requests, email, shop, gift cards, payroll, and more.

## Demo Seed

Run:

```bash
node scripts/seed-demo-data.mjs
```

Current seeded demo coverage:

- 24 events across upcoming, sold-out, low-fill, private, corporate, kids, brunch, and past classes.
- 30 orders.
- 165 attendees.
- 17 event assignments.
- 6 payroll records.
- 6 gift cards.
- 16 newsletter subscribers.
- 6 products and 6 product orders.
- 4 corporate accounts.
- 7 private event requests.
- 7 email broadcasts.
- 6 waitlist entries.

Known seed skip until backend migration is applied:

- `customer_memberships`
- `membership_credit_redemptions`

Those are missing in the live Supabase schema right now.

## Current Backend Gaps

Jason needs to handle backend work that cannot be safely completed from the frontend/demo anon key:

- Apply membership credit tables and `create_order_with_membership_credits` RPC.
- Add missing schema fields such as coupon source/platform/date fields and `events.is_archived`.
- Align database status constraints with UI status values.
- Add RLS and server-side role enforcement.
- Wire Stripe subscription products, customer portal, webhooks, membership renewals, and failed-payment handling.
- Apply email schema, deploy Supabase email worker/test/webhook functions, and connect a real email provider.
- Apply analytics schema if frontend analytics should be shared across browsers and persisted in Supabase. The admin analytics UI now expects date range, audience, event type, source, funnel, journey-area, CSV-export, campaign-link attribution, and backend read access to `analytics_events`.
- Persist Email Center templates, campaigns, suppression list, preferences, campaign tracking/UTM settings, and Marketing Center saved tracking links in Supabase instead of localStorage.
- Build private event proposal/deposit/contract tables and payment flow.
- Replace demo/localStorage fallbacks with backend persistence for production.

Full details live in `docs/jason-backend-implementation-prd.md`.

## Demo Vs Production Boundary

The current local experience is intentionally demo-friendly. Some features are production-shaped but not production-backed until Jason completes the backend PRD.

Demo/local fallback areas:

- memberships when backend tables are missing
- some customer account state
- some email workspace/editor state
- assistant/action memory
- preferences where backend table is absent

Production should require:

- Supabase migrations applied
- RLS policies verified
- server-side service role functions only for privileged writes
- Stripe webhooks configured
- email worker dry-run verified before real sends
- demo seed blocked from production unless intentionally enabled

## QA Status

Recent checks:

- `npm run lint` passes.
- `/admin` loads with seeded demo data.
- Dashboard shows expanded event data including `Sip & Sketch: Lakehouse Lines`, `Mountain Sunset`, `Lake Reflections`, and `Monet Garden Brunch`.

## Suggested Next Conversation Starting Point

If reopening this in another chat, start with:

> We are on the Easel Paint & Sip branch `codex-owner-dashboard-briefing`. Read `docs/project-handoff-context.md` and `docs/jason-backend-implementation-prd.md` first. The local app runs at `http://127.0.0.1:5173`. The demo seed is `node scripts/seed-demo-data.mjs`.
