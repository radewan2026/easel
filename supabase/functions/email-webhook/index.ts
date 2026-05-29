import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

const EVENT_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.sent': 'sent',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  delivery: 'delivered',
  open: 'opened',
  click: 'clicked',
  bounce: 'bounced',
  spamreport: 'complained',
  deferred: 'failed',
  dropped: 'failed',
};

const BOUNCE_EVENTS = new Set(['email.bounced', 'bounce']);
const COMPLAINT_EVENTS = new Set(['email.complained', 'spamreport']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return json({ error: 'Invalid JSON payload' }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Normalize Resend and SendGrid formats into a list of events
  const events = normalizeEvents(payload);

  const results: { event_type: string; send_id: string | null; action: string }[] = [];

  for (const event of events) {
    const {
      providerEventId,
      providerMessageId,
      recipientEmail,
      rawEventType,
      occurredAt,
    } = event;

    const eventType = EVENT_MAP[rawEventType] || rawEventType;

    // Find the send record by provider_message_id or recipient_email
    let query = supabase
      .from('email_sends')
      .select('id, recipient_email, status');

    if (providerMessageId) {
      query = query.eq('provider_message_id', providerMessageId);
    } else if (recipientEmail) {
      query = query.eq('recipient_email', recipientEmail.toLowerCase()).is('provider_message_id', null);
    } else {
      results.push({ event_type: rawEventType, send_id: null, action: 'skipped: no message_id or email' });
      continue;
    }

    const { data: sendRecords } = await query.order('created_at', { ascending: false }).limit(1);
    const send = sendRecords?.[0];

    if (!send) {
      results.push({ event_type: rawEventType, send_id: null, action: 'skipped: no matching send record' });
      continue;
    }

    // Store raw event
    const { error: eventError } = await supabase.from('email_events').insert({
      send_id: send.id,
      provider: Deno.env.get('EMAIL_PROVIDER') || 'resend',
      provider_event_id: providerEventId,
      event_type: eventType,
      payload,
      occurred_at: occurredAt ?? new Date().toISOString(),
    });

    if (eventError) {
      results.push({ event_type: rawEventType, send_id: send.id, action: `event insert failed: ${eventError.message}` });
      continue;
    }

    // Build update for email_sends
    const update: Record<string, string> = { status: eventType };
    const timestampField = statusToTimestampField(eventType);
    if (timestampField) {
      update[timestampField] = occurredAt ?? new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('email_sends')
      .update(update)
      .eq('id', send.id);

    if (updateError) {
      results.push({ event_type: rawEventType, send_id: send.id, action: `update failed: ${updateError.message}` });
      continue;
    }

    // Auto-suppress on bounce or complaint
    if (BOUNCE_EVENTS.has(rawEventType) || COMPLAINT_EVENTS.has(rawEventType)) {
      const reason = BOUNCE_EVENTS.has(rawEventType) ? 'bounce' : 'complaint';
      const { error: suppressError } = await supabase
        .from('email_suppression_list')
        .upsert(
          {
            email: send.recipient_email,
            reason,
            provider_event_id: providerEventId,
            notes: `Auto-suppressed via webhook event: ${rawEventType}`,
          },
          { onConflict: 'email,reason' },
        );

      if (suppressError) {
        results.push({ event_type: rawEventType, send_id: send.id, action: `suppression failed: ${suppressError.message}` });
      } else {
        results.push({ event_type: rawEventType, send_id: send.id, action: `updated to ${eventType}, auto-suppressed (${reason})` });
      }
    } else {
      results.push({ event_type: rawEventType, send_id: send.id, action: `updated to ${eventType}` });
    }
  }

  return json({ accepted: true, processed: results.length, results });
});

function normalizeEvents(payload: Record<string, unknown>): Array<{
  providerEventId: string | null;
  providerMessageId: string | null;
  recipientEmail: string | null;
  rawEventType: string;
  occurredAt: string | null;
}> {
  // Resend webhook format: { type: 'email.delivered', data: { email_id: '...', to: ['...'] } }
  if (payload.type && typeof payload.type === 'string' && payload.type.startsWith('email.')) {
    const data = payload.data as Record<string, unknown> | undefined;
    return [{
      providerEventId: String(payload.id ?? ''),
      providerMessageId: String(data?.email_id ?? data?.id ?? ''),
      recipientEmail: extractEmail(data?.to),
      rawEventType: String(payload.type),
      occurredAt: String(payload.created_at ?? '') || null,
    }];
  }

  // SendGrid event webhook format: array of events
  if (Array.isArray(payload)) {
    return payload.map((item: Record<string, unknown>) => ({
      providerEventId: String(item.sg_event_id ?? item.id ?? ''),
      providerMessageId: String(item.sg_message_id ?? item.email_id ?? item.message_id ?? ''),
      recipientEmail: String(item.email ?? ''),
      rawEventType: String(item.event ?? ''),
      occurredAt: String(item.timestamp ?? item.created_at ?? '') || null,
    }));
  }

  // Fallback: treat as single event
  return [{
    providerEventId: String(payload.id ?? payload.event_id ?? ''),
    providerMessageId: String(payload.message_id ?? payload.email_id ?? ''),
    recipientEmail: extractEmail(payload.to ?? payload.recipient ?? payload.email),
    rawEventType: String(payload.event ?? payload.type ?? 'unknown'),
    occurredAt: String(payload.created_at ?? payload.timestamp ?? '') || null,
  }];
}

function extractEmail(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.length > 0 ? String(val[0]) : null;
  return null;
}

function statusToTimestampField(status: string): string | null {
  switch (status) {
    case 'sent': return 'sent_at';
    case 'delivered': return 'delivered_at';
    case 'opened': return 'opened_at';
    case 'clicked': return 'clicked_at';
    default: return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
