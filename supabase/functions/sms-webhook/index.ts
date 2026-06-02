import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Handle Twilio's webhook format (form-encoded)
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = String(value);
    }
    await handleTwilioWebhook(supabase, params);
    return new Response('<Response />', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  // Handle JSON payloads (for testing or alternate providers)
  const payload = await req.json().catch(() => ({}));
  const provider = payload.provider || 'twilio';

  if (provider === 'twilio') {
    await handleTwilioWebhook(supabase, payload);
    return json({ ok: true });
  }

  return json({ error: 'Unknown provider' }, 400);
});

async function handleTwilioWebhook(
  supabase: ReturnType<typeof createClient>,
  params: Record<string, string>,
) {
  const messageSid = params.MessageSid || params.SmsSid || '';
  const messageStatus = params.MessageStatus || params.SmsStatus || '';
  const from = params.From || params.Msn || '';
  const errorCode = params.ErrorCode || '';
  const errorMessage = params.ErrorMessage || '';

  if (!messageSid) {
    return;
  }

  // Map Twilio status to our status
  const statusMap: Record<string, string> = {
    queued: 'queued',
    sending: 'sent',
    sent: 'sent',
    delivered: 'delivered',
    undelivered: 'failed',
    failed: 'failed',
    read: 'delivered',
    rejected: 'bounced',
  };

  const ourStatus = statusMap[messageStatus.toLowerCase()] || messageStatus.toLowerCase();

  // Update the message record
  const { data: messages } = await supabase
    .from('sms_messages')
    .select('id')
    .eq('provider_message_id', messageSid)
    .limit(1);

  const messageId = messages?.[0]?.id;

  if (messageId) {
    const updates: Record<string, unknown> = {
      provider_status: messageStatus,
    };

    if (ourStatus === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    } else if (ourStatus === 'failed' || ourStatus === 'bounced') {
      updates.failed_reason = errorMessage || `Twilio error code: ${errorCode}`;
    }

    if (ourStatus !== 'queued' && ourStatus !== 'sent') {
      updates.status = ourStatus;
    }

    await supabase.from('sms_messages').update(updates).eq('id', messageId);
  }

  // Log the event
  await supabase.from('sms_events').insert({
    message_id: messageId || null,
    provider: 'twilio',
    provider_event_id: messageSid,
    event_type: messageStatus,
    payload: params,
    occurred_at: new Date().toISOString(),
  });

  // Auto-suppress bounced numbers
  if (ourStatus === 'bounced' && from) {
    const alreadySuppressed = await supabase
      .from('sms_suppression_list')
      .select('id')
      .eq('phone', from)
      .eq('reason', 'bounce')
      .maybeSingle();

    if (!alreadySuppressed.data) {
      await supabase.from('sms_suppression_list').insert({
        phone: from,
        reason: 'bounce',
        provider_event_id: messageSid,
        notes: `Auto-suppressed from Twilio webhook: ${errorMessage || 'bounced'}`,
      });
    }
  }

  // Handle opt-out replies (STOP, UNSUBSCRIBE, etc.)
  if (params.Body && ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(params.Body.trim().toUpperCase())) {
    const phone = from;

    if (phone) {
      await supabase.from('sms_suppression_list').insert({
        phone,
        reason: 'opt_out',
        provider_event_id: messageSid,
        notes: `Auto-suppressed from reply: "${params.Body}"`,
      }).catch(() => {});

      await supabase.from('customer_sms_preferences').upsert({
        customer_phone: phone,
        marketing_enabled: false,
        opted_out_at: new Date().toISOString(),
        source: 'sms_reply',
      }, { onConflict: 'customer_phone' }).catch(() => {});
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
