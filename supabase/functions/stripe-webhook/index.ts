import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@17.3.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  if (!stripeSecretKey || !webhookSecret) {
    return json({ error: 'Missing Stripe configuration' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const stripe = Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basel' });

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch {
    return json({ error: 'Invalid signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const customerEmail = session.customer_email || session.customer_details?.email;

        if (subscriptionId && customerId) {
          await supabase
            .from('tenants')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
            })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;

          let planSlug = 'starter';
          if (priceId) {
            const { data: plan } = await supabase
              .from('plans')
              .select('slug')
              .eq('stripe_price_id', priceId)
              .single();
            if (plan) planSlug = plan.slug;
          }

          const { data: plan } = await supabase
            .from('plans')
            .select('id')
            .eq('slug', planSlug)
            .single();

          await supabase
            .from('tenants')
            .update({
              plan_id: plan?.id || null,
              subscription_status: 'active',
              subscription_current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedSubId = failedInvoice.subscription as string;

        if (failedSubId) {
          await supabase
            .from('tenants')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', failedSubId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const subId = sub.id;
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'incomplete' ? 'incomplete'
          : sub.status === 'trialing' ? 'trialing'
          : 'canceled';

        const priceId = sub.items.data[0]?.price.id;
        let planSlug = 'starter';
        if (priceId) {
          const { data: plan } = await supabase
            .from('plans')
            .select('slug')
            .eq('stripe_price_id', priceId)
            .single();
          if (plan) planSlug = plan.slug;
        }

        const { data: plan } = await supabase
          .from('plans')
          .select('id')
          .eq('slug', planSlug)
          .single();

          await supabase
            .from('tenants')
            .update({
              plan_id: plan?.id || null,
              subscription_status: status,
              subscription_current_period_end: new Date(
                sub.current_period_end * 1000
              ).toISOString(),
            })
            .eq('stripe_subscription_id', subId);
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        await supabase
          .from('tenants')
          .update({ subscription_status: 'canceled' })
          .eq('stripe_subscription_id', deletedSub.id);
        break;
      }

      default:
        break;
    }

    return json({ received: true }, 200, corsHeaders);
  } catch (error) {
    console.error('Webhook error:', error);
    return json({ error: 'Webhook handler failed' }, 500, corsHeaders);
  }
});

function json(data: unknown, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
