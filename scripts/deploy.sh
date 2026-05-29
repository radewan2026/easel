#!/usr/bin/env bash
set -euo pipefail

echo "=== Deploying Paint & Sip Supabase changes ==="
echo ""

# ── Step 1: Prerequisites ──────────────────────────────────────────
echo "Prerequisites:"
echo "  1. Supabase CLI (brew install supabase/tap/supabase)"
echo "  2. supabase login  (use your Supabase access token)"
echo "  3. SUPABASE_SERVICE_ROLE_KEY env var set"
echo "  4. Docker running (for local verification)"
echo ""

read -rp "Have all prerequisites been satisfied? (y/N) " ok
[[ "$ok" != "y" ]] && echo "Aborting." && exit 1

# ── Step 2: Push migrations ────────────────────────────────────────
echo ""
echo "--- Step 2: Running migrations ---"
npx supabase db push --include-all

# ── Step 3: Set secrets ────────────────────────────────────────────
echo ""
echo "--- Step 3: Setting Supabase secrets ---"
echo "At minimum you need:"
echo "  RESEND_API_KEY         - for Resend email provider"
echo "  SENDGRID_API_KEY       - for SendGrid email provider (optional)"
echo "  SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS"
echo "  SUPABASE_SERVICE_ROLE_KEY"
echo ""
read -rp "Set secrets now? (y/N) " do_secrets
if [[ "$do_secrets" == "y" ]]; then
  read -rsp "RESEND_API_KEY: " RESEND_API_KEY && echo ""
  read -rsp "SENDGRID_API_KEY: " SENDGRID_API_KEY && echo ""
  read -rp "SMTP_HOST: " SMTP_HOST
  read -rp "SMTP_PORT: " SMTP_PORT
  read -rp "SMTP_USER: " SMTP_USER
  read -rsp "SMTP_PASS: " SMTP_PASS && echo ""
  read -rsp "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY && echo ""

  npx supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"
  npx supabase secrets set SENDGRID_API_KEY="$SENDGRID_API_KEY"
  npx supabase secrets set SMTP_HOST="$SMTP_HOST"
  npx supabase secrets set SMTP_PORT="$SMTP_PORT"
  npx supabase secrets set SMTP_USER="$SMTP_USER"
  npx supabase secrets set SMTP_PASS="$SMTP_PASS"
  npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
fi

# ── Step 4: Deploy edge functions ───────────────────────────────────
echo ""
echo "--- Step 4: Deploying edge functions ---"
for fn in email-worker email-webhook email-track analytics-rollup email-test; do
  echo "  Deploying $fn..."
  npx supabase functions deploy "$fn" --no-verify-jwt
done

echo ""
echo "=== Deployment complete ==="
