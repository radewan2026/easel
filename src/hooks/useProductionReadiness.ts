import { useMemo } from 'react';
import { useSettings } from './useAdmin';
import { useEmailCenter } from './useEmailCenter';
import { useMembershipAdmin } from './useMembershipAdmin';
import { hasAiGateway } from '../lib/aiGateway';

export type ProductionReadinessStatus = 'ready' | 'needs_setup' | 'demo';

export type ProductionReadinessCheck = {
  id: 'supabase' | 'memberships' | 'email_backend' | 'email_provider' | 'payments' | 'ai_gateway';
  title: string;
  body: string;
  status: ProductionReadinessStatus;
  detail: string;
  to: string;
};

function getSiteSettings(settingsRows: unknown, override?: Record<string, string>) {
  if (override) return override;
  const rows = Array.isArray(settingsRows) ? settingsRows : [];
  return (rows.find((setting) => setting?.key === 'siteSettings')?.value || {}) as Record<string, string>;
}

export function useProductionReadiness(settingsOverride?: Record<string, string>) {
  const { data: settings } = useSettings();
  const { data: emailCenter } = useEmailCenter();
  const { data: membershipAdmin } = useMembershipAdmin();

  return useMemo(() => {
    const siteSettings = getSiteSettings(settings, settingsOverride);
    const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    const membershipBackendEnabled = import.meta.env.VITE_MEMBERSHIP_BACKEND_ENABLED === 'true';
    const stripeConfigured = siteSettings.stripeEnabled === 'true' && Boolean(siteSettings.stripePublishableKey && siteSettings.stripeSecretKey);
    const emailProvider = siteSettings.emailProvider || 'smtp';
    const emailProviderConfigured =
      (emailProvider === 'resend' && Boolean(siteSettings.resendApiKey)) ||
      (emailProvider === 'sendgrid' && Boolean(siteSettings.sendgridApiKey)) ||
      (emailProvider === 'smtp' && Boolean(siteSettings.smtpHost && siteSettings.smtpUsername && siteSettings.smtpPassword));
    const aiGatewayConfigured = hasAiGateway();

    const checks: ProductionReadinessCheck[] = [
      {
        id: 'supabase',
        title: 'Supabase project',
        body: 'Core data reads and writes use Supabase tables, RPCs, and Edge Functions.',
        status: supabaseConfigured ? 'ready' : 'needs_setup',
        detail: supabaseConfigured ? 'Environment contains Supabase URL and publishable key.' : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before production deploy.',
        to: '/admin/settings',
      },
      {
        id: 'memberships',
        title: 'Membership credit ledger',
        body: 'Subscriptions and checkout credits should use the backend ledger, not browser demo storage.',
        status: membershipAdmin?.source === 'backend' ? 'ready' : membershipBackendEnabled ? 'needs_setup' : 'demo',
        detail: membershipAdmin?.source === 'backend'
          ? 'Membership tables and redemption queries are connected.'
          : 'Apply supabase/migrations/20260523104500_membership_credit_ledger.sql, then enable VITE_MEMBERSHIP_BACKEND_ENABLED=true.',
        to: '/admin/memberships',
      },
      {
        id: 'email_backend',
        title: 'Email campaign backend',
        body: 'Campaign drafts, approvals, and delivery workers need the email broadcast table and Edge Functions.',
        status: emailCenter?.backendConnected ? 'ready' : 'needs_setup',
        detail: emailCenter?.backendConnected ? 'Email broadcast table is connected.' : 'Create/verify email_broadcasts and deploy email-test, email-worker, and email-webhook functions.',
        to: '/admin/email',
      },
      {
        id: 'email_provider',
        title: 'Email provider',
        body: 'Owner campaigns and transactional sends need a production provider and verified sender domain.',
        status: emailProviderConfigured ? 'ready' : 'needs_setup',
        detail: emailProviderConfigured ? `${emailProvider.toUpperCase()} settings are present in this workspace.` : 'Configure SMTP, Resend, or SendGrid settings and verify the sending domain.',
        to: '/admin/settings',
      },
      {
        id: 'payments',
        title: 'Payments',
        body: 'Checkout, memberships, deposits, and invoices need live payment credentials before launch.',
        status: stripeConfigured ? 'ready' : 'needs_setup',
        detail: stripeConfigured ? 'Stripe is enabled with local credential fields filled.' : 'Enable Stripe and add publishable key, secret key, and webhook secret in Payment Methods.',
        to: '/admin/settings',
      },
      {
        id: 'ai_gateway',
        title: 'AI gateway',
        body: 'Ask Easel and generated content should call a server-side gateway so provider keys stay off the client.',
        status: aiGatewayConfigured ? 'ready' : 'needs_setup',
        detail: aiGatewayConfigured ? 'VITE_AI_GATEWAY_URL is configured.' : 'Set VITE_AI_GATEWAY_URL to your backend or Supabase Edge Function.',
        to: '/admin/settings',
      },
    ];

    return {
      checks,
      readyCount: checks.filter((check) => check.status === 'ready').length,
      demoCount: checks.filter((check) => check.status === 'demo').length,
      needsSetupCount: checks.filter((check) => check.status === 'needs_setup').length,
      allReady: checks.every((check) => check.status === 'ready'),
      byId: Object.fromEntries(checks.map((check) => [check.id, check])) as Record<ProductionReadinessCheck['id'], ProductionReadinessCheck>,
    };
  }, [emailCenter?.backendConnected, membershipAdmin?.source, settings, settingsOverride]);
}
