import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@17.3.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  if (!stripeSecretKey) {
    return json({ error: 'Missing STRIPE_SECRET_KEY' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const stripe = Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basel' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let planSlug: string;
  try {
    const body = await req.json();
    planSlug = body.plan_slug;
  } catch {
    return json({ error: 'Invalid request body. Provide plan_slug.' }, 400);
  }

  if (!planSlug) {
    return json({ error: 'plan_slug is required' }, 400);
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, slug, price_monthly, stripe_price_id, description')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .single();

  if (!plan) {
    return json({ error: `Plan "${planSlug}" not found` }, 404);
  }

  if (!plan.stripe_price_id) {
    return json({
      error: `Stripe price not configured for ${plan.name}. Contact support to set up billing.`,
    }, 400);
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, stripe_customer_id, stripe_subscription_id, company_name')
    .single();

  if (!tenant) {
    return json({ error: 'Tenant not found' }, 404);
  }

  try {
    let customerId = tenant.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { tenant_id: tenant.id },
      });
      customerId = customer.id;

      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: plan.stripe_price_id,
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: {
        metadata: { tenant_id: tenant.id, plan_slug: plan.slug },
      },
      client_reference_id: tenant.id,
      success_url: `${req.headers.get('origin') || 'http://localhost:5173'}/admin/settings?tab=billing&upgrade=success`,
      cancel_url: `${req.headers.get('origin') || 'http://localhost:5173'}/admin/settings?tab=billing&upgrade=canceled`,
    });

    return json({ url: session.url }, 200, corsHeaders);
  } catch (error) {
    console.error('Checkout session error:', error);
    return json({ error: 'Failed to create checkout session' }, 500, corsHeaders);
  }
});

function json(data: unknown, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
