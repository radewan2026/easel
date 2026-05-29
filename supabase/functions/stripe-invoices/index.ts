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
    .select('stripe_customer_id')
    .single();

  if (!tenant?.stripe_customer_id) {
    return json({ invoices: [] }, 200, corsHeaders);
  }

  try {
    const stripeInvoices = await stripe.invoices.list({
      customer: tenant.stripe_customer_id,
      limit: 12,
    });

    const invoices = stripeInvoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid,
      amount_due: inv.amount_due,
      status: inv.status,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      paid_at: inv.status === 'paid' && inv.paid_at
        ? new Date(inv.paid_at * 1000).toISOString()
        : null,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      lines: inv.lines.data.map((line) => ({
        description: line.description,
        amount: line.amount,
        period: {
          start: new Date(line.period.start * 1000).toISOString(),
          end: new Date(line.period.end * 1000).toISOString(),
        },
      })),
    }));

    return json({ invoices }, 200, corsHeaders);
  } catch (error) {
    console.error('Invoice list error:', error);
    return json({ error: 'Failed to retrieve invoices' }, 500, corsHeaders);
  }
});

function json(data: unknown, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
