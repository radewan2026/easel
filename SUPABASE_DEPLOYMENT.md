# Supabase Deployment Instructions

## Prerequisites

1. **Supabase project** — create one at https://supabase.com if not already done
2. **Access token** — generate at https://supabase.com/dashboard/account/tokens
3. **Service role key** — copy from Project Settings → API → service_role key (not anon key)
4. **Supabase CLI** — installed globally (v1.217.0+). Already at `/Users/raleighdewan/.npm-global/bin/supabase` (v2.102.0)

---

## 1. Login & Link

```bash
supabase login
# paste your access token when prompted

supabase link --project-ref <your-project-ref>
# project ref is the subdomain in your Supabase project URL: https://<ref>.supabase.co
```

## 2. Deploy Migrations (7 files)

All migrations run in filename order. Run them all at once:

```bash
supabase db push
```

Migrations included:

| File | Purpose |
|------|---------|
| `20260523104500_membership_credit_ledger.sql` | Membership credit ledger |
| `20260528120000_admin_auth_rls.sql` | Admin auth + RLS hardening |
| `20260528130000_email_system.sql` | Email templates, automations, campaigns, sends, events, suppression |
| `20260528140000_analytics_system.sql` | Analytics events, daily rollups, attribution |
| `20260528150000_gift_card_remaining_balance.sql` | Gift card remaining balance |
| `20260529000000_saas_plans.sql` | SaaS plans / feature gating |
| `20260529100000_sms_system.sql` | SMS templates, preferences, suppression, messages, events |

## 3. Deploy Edge Functions (12 functions)

```bash
supabase functions deploy analytics-rollup
supabase functions deploy email-test
supabase functions deploy email-track
supabase functions deploy email-webhook
supabase functions deploy email-worker
supabase functions deploy sms-webhook
supabase functions deploy sms-worker
supabase functions deploy stripe-checkout
supabase functions deploy stripe-invoices
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook
```

## 4. Set Secrets

```bash
# Required — Supabase (auto-injected by CLI, but confirm)
supabase secrets set SUPABASE_URL=<your-project-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Email provider — pick one
supabase secrets set EMAIL_PROVIDER=resend
supabase secrets set EMAIL_FROM="Easel <noreply@yourdomain.com>"
supabase secrets set RESEND_API_KEY=<resend-api-key>

# OR for SendGrid:
# supabase secrets set EMAIL_PROVIDER=sendgrid
# supabase secrets set SENDGRID_API_KEY=<sendgrid-api-key>

# OR for SMTP:
# supabase secrets set EMAIL_PROVIDER=smtp
# supabase secrets set SMTP_HOST=smtp.yourprovider.com
# supabase secrets set SMTP_PORT=587
# supabase secrets set SMTP_USERNAME=<smtp-username>
# supabase secrets set SMTP_PASSWORD=<smtp-password>

# Email tracking
supabase secrets set PUBLIC_TRACKING_URL=https://<ref>.supabase.co/functions/v1/email-track
supabase secrets set PUBLIC_SITE_URL=https://yourdomain.com

# Twilio (SMS)
supabase secrets set TWILIO_ACCOUNT_SID=<twilio-account-sid>
supabase secrets set TWILIO_AUTH_TOKEN=<twilio-auth-token>
supabase secrets set TWILIO_PHONE_NUMBER=<twilio-phone-number>

# Stripe
supabase secrets set STRIPE_SECRET_KEY=<stripe-secret-key>
supabase secrets set STRIPE_WEBHOOK_SECRET=<stripe-webhook-signing-secret>

# Test recipient
supabase secrets set EMAIL_TEST_RECIPIENT=you@example.com
```

## 5. Post-Deploy Verification

### Dry-run safety

Both email and SMS start in dry-run mode. No real messages are sent until you disable:

```bash
supabase secrets set EMAIL_DRY_RUN=false
supabase secrets set SMS_DRY_RUN=false
```

**Keep dry-run enabled initially** until you verify the credentials work.

### Test email

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/email-test \
  -H "Content-Type: application/json" \
  -d '{"provider": "resend", "to": "you@example.com", "subject": "Test", "body": "<p>Hello</p>"}'
```

### Health checks

- Dashboard: visit `/admin/email-center` — templates and suppression list should load from DB (not localStorage)
- SMS tab: visit `/admin/email-center` → SMS tab — templates should load
- Analytics rollup: runs on cron; verify `/admin/analytics` shows data after 24h

## 6. Config.toml Note

The local `supabase/config.toml` has parsing problems with the edge runtime / functions sections. You may need to fix it before the CLI can read it for local development:

Look for `[functions]` followed by `enabled = true`. This may need to be `functions.enabled = true` as a flat key instead of a table header, depending on your CLI version. If `supabase start` or `supabase functions deploy` fails with a TOML parse error, fix this in config.toml.

---

## Summary Checklist

- [ ] Logged in to Supabase CLI
- [ ] Linked to project
- [ ] 7 migrations deployed
- [ ] 12 edge functions deployed
- [ ] Secrets set (especially service role key, Resend/SendGrid, Twilio, Stripe)
- [ ] Dry-run ON initially
- [ ] Verified with email-test
- [ ] Flipped `EMAIL_DRY_RUN=false` and `SMS_DRY_RUN=false` after verification
