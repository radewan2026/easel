import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type SmsTemplate = {
  id: string;
  name: string;
  body: string;
  trigger_name: string;
  template_type: string;
};

type SmsMessageRecord = {
  id: string;
  recipient_phone: string;
  recipient_name: string | null;
  body_snapshot: string;
  status: string;
  provider_message_id: string | null;
};

type WorkerResult = {
  dryRun: boolean;
  processed: number;
  sent: number;
  suppressed: number;
  failed: number;
  messages: string[];
};

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
  const dryRun = Deno.env.get('SMS_DRY_RUN') !== 'false';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const templateId = body.templateId as string | undefined;
  const recipientPhones = body.recipients as string[] | undefined;
  const customBody = body.body as string | undefined;

  const result: WorkerResult = { dryRun, processed: 0, sent: 0, suppressed: 0, failed: 0, messages: [] };

  if (customBody && recipientPhones) {
    // Direct ad-hoc send with a custom body
    const sendResult = await sendToRecipients({
      supabase,
      body: customBody,
      recipientPhones,
      providerName: 'twilio',
      dryRun,
    });
    result.sent += sendResult.sent;
    result.suppressed += sendResult.suppressed;
    result.failed += sendResult.failed;
    result.messages.push(...sendResult.messages);
    result.processed = recipientPhones.length;
  } else if (templateId) {
    // Send using a template
    const { data: template, error: tmplError } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (tmplError || !template) {
      return json({ error: `Template not found: ${tmplError?.message}` }, 404);
    }

    const resolvedPhones = recipientPhones || await resolveAudience(supabase, body.audience_key || 'all-customers');
    const sendResult = await sendToRecipients({
      supabase,
      body: template.body,
      recipientPhones: resolvedPhones,
      providerName: 'twilio',
      dryRun,
    });
    result.sent += sendResult.sent;
    result.suppressed += sendResult.suppressed;
    result.failed += sendResult.failed;
    result.messages.push(...sendResult.messages);
    result.processed = resolvedPhones.length;
  } else {
    // Fetch active automation templates and process each
    const { data: templates, error: tmplError } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('is_active', true)
      .in('trigger_name', ['event_24h_before', 'checkout_abandoned_60m', 'gift_card_30d']);

    if (tmplError) {
      return json({ error: `Failed to fetch templates: ${tmplError.message}` }, 500);
    }

    for (const template of templates || []) {
      result.processed += 1;
      try {
        const phones = await resolveAudienceForTrigger(supabase, template.trigger_name);
        const sendResult = await sendToRecipients({
          supabase,
          body: template.body,
          recipientPhones: phones,
          providerName: 'twilio',
          dryRun,
        });
        result.sent += sendResult.sent;
        result.suppressed += sendResult.suppressed;
        result.failed += sendResult.failed;
        result.messages.push(...sendResult.messages);
      } catch (err) {
        result.failed += 1;
        result.messages.push(`Template ${template.id} (${template.name}) failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
  }

  return json(result);
});

async function sendToRecipients({
  supabase, body, recipientPhones, providerName, dryRun,
}: {
  supabase: ReturnType<typeof createClient>;
  body: string;
  recipientPhones: string[];
  providerName: string;
  dryRun: boolean;
}): Promise<{ sent: number; suppressed: number; failed: number; messages: string[] }> {
  const messages: string[] = [];
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  if (recipientPhones.length === 0) {
    messages.push('No recipients resolved');
    return { sent: 0, suppressed: 0, failed: 0, messages };
  }

  const suppressedPhones = await getSuppressedPhones(supabase, recipientPhones);

  for (const phone of recipientPhones) {
    if (suppressedPhones.has(normalizePhone(phone))) {
      suppressed += 1;
      await supabase.from('sms_messages').insert({
        recipient_phone: phone,
        body_snapshot: body,
        status: 'opted_out',
        provider: providerName,
      });
      continue;
    }

    try {
      const { data: msgRecord, error: insertError } = await supabase.from('sms_messages').insert({
        recipient_phone: phone,
        body_snapshot: body,
        status: 'queued',
        provider: providerName,
      }).select().single();

      if (insertError) {
        failed += 1;
        messages.push(`Failed to create message record for ${phone}: ${insertError.message}`);
        continue;
      }

      if (dryRun) {
        sent += 1;
        continue;
      }

      const from = Deno.env.get('TWILIO_PHONE_NUMBER') || '';
      const { messageId } = await sendViaTwilio({
        from,
        to: phone,
        body,
      });

      sent += 1;
      await supabase.from('sms_messages').update({
        status: 'sent',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
      }).eq('id', msgRecord.id);
    } catch (err) {
      failed += 1;
      messages.push(`Failed to send to ${phone}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  messages.push(`Processed ${recipientPhones.length} recipients: ${sent} sent, ${suppressed} suppressed, ${failed} failed`);
  return { sent, suppressed, failed, messages };
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').toLowerCase();
}

async function getSuppressedPhones(
  supabase: ReturnType<typeof createClient>,
  phones: string[],
): Promise<Set<string>> {
  if (phones.length === 0) return new Set();
  const { data } = await supabase
    .from('sms_suppression_list')
    .select('phone');
  return new Set((data || []).map((r) => normalizePhone(r.phone)));
}

async function resolveAudience(
  supabase: ReturnType<typeof createClient>,
  audienceKey: string,
): Promise<string[]> {
  switch (audienceKey) {
    case 'all-customers': {
      const { data } = await supabase
        .from('orders')
        .select('purchaser_phone')
        .eq('status', 'paid')
        .not('purchaser_phone', 'is', null);
      return [...new Set((data || []).map((r) => r.purchaser_phone).filter(Boolean))];
    }
    case 'upcoming-attendees': {
      const { data } = await supabase
        .from('orders')
        .select('purchaser_phone, event:events(start_datetime)')
        .eq('status', 'paid')
        .gte('event.start_datetime', new Date().toISOString())
        .not('purchaser_phone', 'is', null);
      return [...new Set((data || []).map((r) => r.purchaser_phone).filter(Boolean))];
    }
    case 'opt-in-marketing': {
      const { data } = await supabase
        .from('customer_sms_preferences')
        .select('customer_phone')
        .eq('marketing_enabled', true);
      return (data || []).map((r) => r.customer_phone);
    }
    default:
      return [];
  }
}

async function resolveAudienceForTrigger(
  supabase: ReturnType<typeof createClient>,
  triggerName: string,
): Promise<string[]> {
  switch (triggerName) {
    case 'event_24h_before': {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { data } = await supabase
        .from('orders')
        .select('purchaser_phone')
        .eq('status', 'paid')
        .gte('event:events(start_datetime)', tomorrow.toISOString())
        .lt('event:events(start_datetime)', new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString())
        .not('purchaser_phone', 'is', null);
      return [...new Set((data || []).map((r) => r.purchaser_phone).filter(Boolean))];
    }
    case 'checkout_abandoned_60m': {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const { data } = await supabase
        .from('orders')
        .select('purchaser_phone')
        .eq('status', 'pending')
        .lt('created_at', new Date().toISOString())
        .gte('created_at', cutoff.toISOString())
        .not('purchaser_phone', 'is', null);
      return [...new Set((data || []).map((r) => r.purchaser_phone).filter(Boolean))];
    }
    case 'gift_card_30d': {
      const { data } = await supabase
        .from('gift_cards')
        .select('purchaser_phone')
        .eq('is_redeemed', false)
        .not('purchaser_phone', 'is', null);
      return [...new Set((data || []).map((r) => r.purchaser_phone).filter(Boolean))];
    }
    default:
      return [];
  }
}

async function sendViaTwilio({ from, to, body }: { from: string; to: string; body: string }) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: body,
        StatusCallback: `${Deno.env.get('SUPABASE_URL') || ''}/functions/v1/sms-webhook`,
      }).toString(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twilio error ${response.status}: ${data.message || JSON.stringify(data)}`);
  }

  return { messageId: String(data.sid) };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
