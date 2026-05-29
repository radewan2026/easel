# Email Center Implementation Notes

## What is implemented now

- Admin route: `/admin/email`
- Navigation: Marketing > Email Center
- Command palette: "Open email center"
- Current data source: existing `email_broadcasts` table for queued/history rows
- Demo-ready defaults: transactional templates and automation rules render before the full backend email schema exists
- Campaign creation: queues an owner-reviewed draft into `email_broadcasts`; the browser does not directly send email

## Backend pieces to add next

Recommended delivery path:

1. Add a server-side email worker.
2. Connect a provider such as Resend, Postmark, SendGrid, or Customer.io.
3. Store provider message IDs on send rows.
4. Ingest webhooks for delivered, bounced, complained, opened, clicked, and unsubscribed.
5. Enforce consent, suppression, and unsubscribe checks before every marketing send.

Suggested tables:

- `email_templates`
- `email_automations`
- `email_campaigns`
- `email_sends`
- `email_events`
- `customer_email_preferences`
- `email_suppression_list`

See `docs/email-system-schema.sql` for the schema reference or `supabase/migrations/20260528130000_email_system.sql` for the deployable migration (includes RLS).

Important rule: transactional emails can be triggered by order, event, membership, gift card, and private request workflows, but marketing emails should only send to opted-in audiences and should require owner confirmation.

## Phase 2 UI added

- Email Center > Settings tab
- Provider selection for Resend, Postmark, SendGrid, or Customer.io
- From name, from email, reply-to, and sending-domain fields
- Owner approval toggle for marketing sends
- Production checklist covering SPF/DKIM/DMARC, server-only API keys, suppression lists, audit trails, and consent separation

## Phase 3 owner controls added

- Owner-editable template editor with subject, preview text, body, type, trigger, and enabled state
- Campaign builder can load templates, choose CRM audiences, queue for approval, or queue a scheduled draft
- CRM segment builder supports saved custom audiences with source, intent, rule, and estimated count
- Suppression list UI supports manual unsubscribe, bounce, complaint, and manual suppression entries
- These controls currently persist in browser local storage for demo safety; production persistence should use the schema contract in `docs/email-system-schema.sql`

## Phase 4 workflow layer added

- Email workspace can be synced into the existing `settings` table under `email_center_workspace`
- Email Center loads saved templates, custom segments, suppression list, and provider settings from that workspace key
- Campaign history now has approve and cancel controls for queued/draft campaigns
- Performance tab shows campaign-level status, recipients, open rate, click rate, created date, opt-out health, suppression count, and owner-approved send count
- This still does not send email; approved campaigns should be picked up by a server-side worker after provider, consent, and suppression checks pass

## Phase 5 delivery layer added

- Email Center > Delivery tab shows worker readiness, approved queue count, approval backlog, and suppression blocks
- `supabase/functions/email-worker/index.ts` handles suppression, preferences, individual send records, multi-provider (Resend, SendGrid, SMTP), campaigns + legacy broadcasts
- `supabase/functions/email-webhook/index.ts` updates send statuses, auto-suppresses on bounce/complaint, supports Resend and SendGrid webhook formats
- Worker defaults to dry-run mode unless `EMAIL_DRY_RUN=false`
- Resend test-recipient mode is stubbed behind `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_TEST_RECIPIENT`

Recommended Supabase secrets:

- `EMAIL_PROVIDER=resend`
- `EMAIL_DRY_RUN=true` initially
- `RESEND_API_KEY=...`
- `EMAIL_FROM=Lake Tahoe Paint & Sip <hello@yourdomain.com>`
- `EMAIL_TEST_RECIPIENT=owner@example.com`

Recommended deployment:

```bash
supabase functions deploy email-worker
supabase functions deploy email-webhook
```

The worker should be scheduled after the full schema and provider credentials are ready. Keep dry-run on until suppression, preferences, and webhook storage have been verified.

## Phase 6 customer preference layer added

- `/unsubscribe` is now a full email preference center instead of a single newsletter opt-out page
- Customers can control marketing emails, private event updates, and membership updates separately
- Transactional emails remain enabled for receipts, booking confirmations, payment notices, and account security
- Customer account page links directly to `/unsubscribe?email=...`
- Preferences are stored locally for demo continuity. Set `VITE_EMAIL_PREFERENCES_BACKEND_ENABLED=true` after `customer_email_preferences` and `email_suppression_list` exist to sync them to Supabase.
- Marketing opt-out also updates `newsletter_subscribers.is_active=false` and attempts to add an `unsubscribe` suppression record

## Phase 7 visual editor added

- Templates tab now includes a visual HTML email builder
- Supported blocks: heading, text, button, image, and divider
- Merge tag chips insert common variables such as `{{first_name}}`, `{{event_title}}`, `{{event_datetime}}`, `{{credit_count}}`, and `{{unsubscribe_url}}`
- Desktop and mobile preview render the generated email HTML before saving
- Saving a template writes provider-ready HTML back into the template body with lightweight block comments for future parsing

## Phase 8 advanced visual editor added

- Added hero, promo, event card, two-column, and spacer blocks
- Added prebuilt layouts for event promo, membership credit reminder, and private event follow-up
- Added per-block text color, accent color, background color, alignment, and spacing controls
- Added block reordering controls
- Generated HTML now includes a hidden preheader area, brand header, card styling, and richer email-safe table markup for columns

## Phase 9 editor usability added

- Blocks can be reordered with native drag and drop in addition to up/down controls
- Image blocks can select from recent gallery images
- Preview panel includes Gmail-style inbox preview for sender, subject, and preheader truncation
- Preview panel includes a deliverability checklist for subject length, preheader length, unsubscribe link, CTA/link presence, and image balance
- Added `supabase/functions/email-test/index.ts` for safe test-email requests; it defaults to dry-run unless `EMAIL_DRY_RUN=false`

## Phase 10 governance and advanced editing added

- Template saves now create local version-history snapshots with restore controls
- Reusable brand styles control generated email header, background, card, footer, and accent colors
- Merge tags are grouped by customer, event, order, membership, gift card, and private event context
- Visual blocks can include conditional-display rules such as membership credits, gift card balance, event URL, or proposal URL
- Campaign history now exposes approval detail with audience snapshot, suppression count, and final sample subject

## Phase 11-12 campaign testing and readiness added

- Campaign drafts now support subject-line A/B testing with a configurable test pool and winning metric
- Campaign drafts include a send-readiness simulation for total audience, suppression blocks, holdout, deliverable estimate, and variant split
- Queueing is blocked when required readiness checks fail, such as missing audience, missing subject, missing scheduled time, or missing variant B
- Approval detail now includes experiment and holdout context so owners can review the exact planned send shape

## Phase 13 attribution and tracking added

- Campaign builder now includes UTM controls for source, medium, campaign, and content
- Owners can apply tracking to existing HTML links in a campaign draft
- If a campaign draft has no HTML link, the UI can append a tracked `{{event_url}}` link
- Template button and event blocks now include an `Add UTM` action for CTA links
- Marketing Center now includes a standalone campaign link builder for social posts, QR codes, partner links, paid ads, and other non-email placements
- Marketing Center can save up to 20 generated tracking links locally for reuse; each saved link can jump into `/admin/analytics` with source/campaign filters preselected. Analytics shows saved-link visits, conversions, and conversion rate by matching source/campaign attribution. Production should persist these as marketing assets in Supabase
- Saved links can generate a QR preview and downloadable PNG through a client-side public QR image endpoint for demo use. Production should either generate QR assets first-party or proxy the QR generation through a backend-controlled service.
- The campaign body queued for approval includes the tracking preview so Jason's backend worker can preserve attribution through delivery
- This is designed to feed `/admin/analytics`, where UTM source/medium can now be filtered and tied to checkout/private request outcomes

## Phase 14 abandoned checkout recovery added

- Event checkout now records `checkout_start` and `checkout_abandoned` analytics events when a guest interacts with checkout and leaves before completion
- `/admin/analytics` shows recoverable abandoned checkout rows with event, guest email, seats, amount due, source/campaign, and an owner-facing recovery action
- Analytics can hand off a recovery draft to Email Center through local workspace state
- Email Center now includes an `Abandoned Checkout Recovery` template, automation rule, recoverable CRM segment, wait-period setting, completion-dedupe option, and required safeguard checklist
- Demo mode queues owner-reviewed campaign drafts only. Production should persist recovery opportunities server-side, dedupe by customer/session/event, respect suppression/preferences, wait the configured delay, and skip anyone who completes a later booking
