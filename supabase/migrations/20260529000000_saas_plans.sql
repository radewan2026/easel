-- SaaS plans + tenant subscription migration
-- Adds plans table (pricing tiers with feature flags) and updates tenant record

-- 1. Plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly INTEGER NOT NULL, -- in cents
  stripe_price_id TEXT, -- Stripe price ID for subscription sync
  features JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tenants table (the studio's SaaS subscription)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  plan_id UUID REFERENCES public.plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  subscription_current_period_end TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 4. Ensure is_admin() function exists (defined in 20260528120000_admin_auth_rls.sql)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
    AND admin_role IN ('admin', 'manager')
    AND status = 'active'
  );
$$;

-- 5. RLS policies: admins can read plans; only admins can read/update the tenant row
CREATE POLICY "plans_select_active" ON public.plans FOR SELECT
  USING (is_active = true AND is_admin());

CREATE POLICY "plans_insert_admin" ON public.plans FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "plans_update_admin" ON public.plans FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "plans_delete_admin" ON public.plans FOR DELETE
  USING (is_admin());

-- Tenant: only the one row for this studio, admins can read/update
CREATE POLICY "tenants_select_admin" ON public.tenants FOR SELECT
  USING (is_admin());

CREATE POLICY "tenants_insert_admin" ON public.tenants FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "tenants_update_admin" ON public.tenants FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- 5. Seed plan tiers
INSERT INTO public.plans (name, slug, description, price_monthly, features, sort_order) VALUES
  ('Starter', 'starter', 'Essential tools to run your paint-and-sip studio.', 14900, '{
    "analytics": false,
    "email_marketing": false,
    "gift_cards": false,
    "referrals": false,
    "corporate_accounts": false,
    "api_access": false,
    "automations": false,
    "unlimited_staff": false,
    "max_staff": 5,
    "support_level": "standard"
  }', 1),
  ('Growth', 'growth', 'Advanced marketing and analytics to grow your business.', 29900, '{
    "analytics": true,
    "email_marketing": true,
    "gift_cards": false,
    "referrals": false,
    "corporate_accounts": true,
    "api_access": false,
    "automations": false,
    "unlimited_staff": true,
    "max_staff": null,
    "support_level": "priority"
  }', 2),
  ('Pro', 'pro', 'Full platform access with premium features and dedicated support.', 49900, '{
    "analytics": true,
    "email_marketing": true,
    "gift_cards": true,
    "referrals": true,
    "corporate_accounts": true,
    "api_access": true,
    "automations": true,
    "unlimited_staff": true,
    "max_staff": null,
    "support_level": "dedicated"
  }', 3),
  ('Enterprise', 'enterprise', 'Custom pricing, dedicated infrastructure, and white-glove onboarding.', 0, '{
    "analytics": true,
    "email_marketing": true,
    "gift_cards": true,
    "referrals": true,
    "corporate_accounts": true,
    "api_access": true,
    "automations": true,
    "unlimited_staff": true,
    "max_staff": null,
    "support_level": "white-glove"
  }', 4)
ON CONFLICT (slug) DO NOTHING;

-- 6. Seed default tenant (the studio itself) on Starter plan
INSERT INTO public.tenants (company_name, plan_id, subscription_status, settings)
SELECT
  'Easel Paint & Sip',
  id,
  'active',
  '{"studio_name": "Easel Paint & Sip", "timezone": "America/New_York"}'::jsonb
FROM public.plans
WHERE slug = 'starter'
ON CONFLICT DO NOTHING;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON public.tenants(plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON public.tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON public.tenants(stripe_customer_id);

-- 8. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
