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

  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_customer_id, company_name')
    .single();

  if (!tenant?.stripe_customer_id) {
    return json({ error: 'No Stripe customer ID found. Contact support.' }, 400);
  }

  try {
    const returnUrl = new URL(req.headers.get('origin') || 'http://localhost:5173');
    returnUrl.pathname = '/admin/settings';
    returnUrl.searchParams.set('tab', 'billing');

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: returnUrl.toString(),
    });

    return json({ url: session.url }, 200, corsHeaders);
  } catch (error) {
    console.error('Portal session error:', error);
    return json({ error: 'Failed to create portal session' }, 500, corsHeaders);
  }
});

function json(data: unknown, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
