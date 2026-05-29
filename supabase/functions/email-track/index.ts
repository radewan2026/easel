import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSPARENT_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || url.pathname.split('/').pop() || '';
  const sendId = url.searchParams.get('send_id') || '';
  const recipientEmail = url.searchParams.get('email') || '';
  const targetUrl = url.searchParams.get('url') || '';

  if (!sendId) {
    return new Response('Missing send_id', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Server config error', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (action === 'open' || action === 'pixel') {
    return handleOpen({ supabase, sendId, recipientEmail });
  }

  if (action === 'click') {
    return handleClick({ supabase, sendId, recipientEmail, targetUrl });
  }

  return new Response('Unknown action. Use ?action=open or ?action=click', { status: 400 });
});

async function handleOpen({
  supabase, sendId,
}: {
  supabase: ReturnType<typeof createClient>;
  sendId: string;
  recipientEmail: string;
}) {
  // Update send status to opened (only if currently sent or delivered)
  const { data: send } = await supabase
    .from('email_sends')
    .select('id, status')
    .eq('id', sendId)
    .single();

  if (send && ['sent', 'delivered'].includes(send.status)) {
    await supabase
      .from('email_sends')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', sendId);

    await supabase.from('email_events').insert({
      send_id: sendId,
      provider: 'track',
      event_type: 'opened',
      payload: { tracked_at: new Date().toISOString() },
      occurred_at: new Date().toISOString(),
    });
  }

  return new Response(TRANSPARENT_PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Length': String(TRANSPARENT_PIXEL.length),
    },
  });
}

async function handleClick({
  supabase, sendId, targetUrl,
}: {
  supabase: ReturnType<typeof createClient>;
  sendId: string;
  recipientEmail: string;
  targetUrl: string;
}) {
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // Decode the target URL
  const decodedUrl = decodeURIComponent(targetUrl);

  // Update send status to clicked (only if at least sent)
  const { data: send } = await supabase
    .from('email_sends')
    .select('id, status, campaign_id, recipient_email')
    .eq('id', sendId)
    .single();

  if (send && !['bounced', 'complained', 'failed', 'suppressed'].includes(send.status)) {
    const now = new Date().toISOString();
    await supabase
      .from('email_sends')
      .update({ status: 'clicked', clicked_at: now })
      .eq('id', sendId);

    await supabase.from('email_events').insert({
      send_id: sendId,
      provider: 'track',
      event_type: 'clicked',
      payload: { url: decodedUrl, tracked_at: now },
      occurred_at: now,
    });

    // Also write to analytics_events for attribution
    await supabase.from('analytics_events').insert({
      id: crypto.randomUUID(),
      event_name: 'email_link_click',
      path: decodedUrl,
      title: 'Email campaign link click',
      anonymous_id: `email_${sendId}`,
      session_id: `email_${send.campaign_id || sendId}`,
      user_type: 'customer',
      user_email: send.recipient_email,
      properties: {
        send_id: sendId,
        campaign_id: send.campaign_id,
        url: decodedUrl,
        attribution: {
          source: 'email',
          medium: send.campaign_id ? 'campaign' : 'transactional',
          campaign: send.campaign_id,
        },
      },
      occurred_at: now,
    });
  }

  return Response.redirect(decodedUrl, 302);
}
