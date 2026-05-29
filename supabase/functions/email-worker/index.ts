import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  body_snapshot: string | null;
  audience_key: string;
  status: string;
  recipient_count: number;
  scheduled_at: string | null;
  approved_by: string | null;
};

type EmailBroadcast = {
  id: string;
  subject: string;
  body: string;
  recipient_count: number;
  status: string;
};

type SendRecord = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject_snapshot: string;
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

type ProviderAdapter = (opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}) => Promise<{ messageId: string }>;

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
  const providerName = Deno.env.get('EMAIL_PROVIDER') || 'resend';
  const dryRun = Deno.env.get('EMAIL_DRY_RUN') !== 'false';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const limit = Number(new URL(req.url).searchParams.get('limit') || 10);
  const result: WorkerResult = { dryRun, processed: 0, sent: 0, suppressed: 0, failed: 0, messages: [] };

  // Fetch approved campaigns from email_campaigns table (new system)
  const { data: campaigns, error: campError } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(limit);

  // Also check legacy email_broadcasts for backward compatibility
  const { data: broadcasts, error: bcError } = await supabase
    .from('email_broadcasts')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (campError && bcError) {
    return json({ error: `Failed to fetch campaigns: ${campError?.message ?? ''} ${bcError?.message ?? ''}` }, 500);
  }

  const allCampaigns: EmailCampaign[] = (campaigns || []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: String(c.name ?? ''),
    subject: String(c.subject ?? ''),
    body_snapshot: c.body_snapshot ? String(c.body_snapshot) : null,
    audience_key: String(c.audience_key ?? ''),
    status: String(c.status ?? ''),
    recipient_count: Number(c.recipient_count ?? 0),
    scheduled_at: c.scheduled_at ? String(c.scheduled_at) : null,
    approved_by: c.approved_by ? String(c.approved_by) : null,
  }));

  const allBroadcasts: EmailBroadcast[] = (broadcasts || []).map((b: Record<string, unknown>) => ({
    id: String(b.id),
    subject: String(b.subject ?? ''),
    body: String(b.body ?? ''),
    recipient_count: Number(b.recipient_count ?? 0),
    status: String(b.status ?? ''),
  }));

  // Process new-style campaigns
  for (const campaign of allCampaigns) {
    result.processed += 1;
    try {
      const sendResult = await processCampaign({ supabase, campaign, providerName, dryRun });
      result.sent += sendResult.sent;
      result.suppressed += sendResult.suppressed;
      result.failed += sendResult.failed;
      result.messages.push(...sendResult.messages);

      if (dryRun) {
        // Keep as approved in dry run mode
      } else {
        await supabase
          .from('email_campaigns')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', campaign.id);
      }
    } catch (err) {
      result.failed += 1;
      result.messages.push(`Campaign ${campaign.id} (${campaign.name}) failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // Process legacy broadcasts
  for (const broadcast of allBroadcasts) {
    result.processed += 1;
    try {
      const sendResult = await processBroadcast({ supabase, broadcast, providerName, dryRun });
      result.sent += sendResult.sent;
      result.suppressed += sendResult.suppressed;
      result.failed += sendResult.failed;
      result.messages.push(...sendResult.messages);

      if (!dryRun && sendResult.sent > 0) {
        await supabase
          .from('email_broadcasts')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', broadcast.id);
      }
    } catch (err) {
      result.failed += 1;
      result.messages.push(`Broadcast ${broadcast.id} failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return json(result);
});

async function processCampaign({
  supabase, campaign, providerName, dryRun,
}: {
  supabase: ReturnType<typeof createClient>;
  campaign: EmailCampaign;
  providerName: string;
  dryRun: boolean;
}): Promise<{ sent: number; suppressed: number; failed: number; messages: string[] }> {
  const messages: string[] = [];
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  // Resolve audience to email list
  const recipients = await resolveAudience(supabase, campaign.audience_key);

  if (recipients.length === 0) {
    messages.push(`Campaign ${campaign.id} (${campaign.name}): no recipients resolved for audience "${campaign.audience_key}"`);
    return { sent: 0, suppressed: 0, failed: 0, messages };
  }

  // Check suppression list
  const suppressedEmails = await getSuppressedEmails(supabase, recipients.map((r) => r.email));

  for (const recipient of recipients) {
    if (suppressedEmails.has(recipient.email.toLowerCase())) {
      suppressed += 1;
      // Record suppressed send
      await supabase.from('email_sends').insert({
        campaign_id: campaign.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name || null,
        subject_snapshot: campaign.subject,
        body_snapshot: campaign.body_snapshot || '',
        status: 'suppressed',
        provider: providerName,
      });
      continue;
    }

    try {
      // Create send record FIRST to get the send_id for tracking
      const { data: sendRecord, error: insertError } = await supabase.from('email_sends').insert({
        campaign_id: campaign.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name || null,
        subject_snapshot: campaign.subject,
        body_snapshot: campaign.body_snapshot || '',
        status: dryRun ? 'queued' : 'queued',
        provider: providerName,
      }).select().single();

      if (insertError) {
        failed += 1;
        messages.push(`Failed to create send record for ${recipient.email}: ${insertError.message}`);
        continue;
      }

      const sendId = sendRecord.id;

      if (dryRun) {
        sent += 1;
        continue;
      }

      const from = Deno.env.get('EMAIL_FROM') || '';
      const trackingBase = Deno.env.get('PUBLIC_TRACKING_URL') || `${Deno.env.get('SUPABASE_URL') || ''}/functions/v1/email-track`;
      const html = injectTracking({
        html: (campaign.body_snapshot || '')
          .replaceAll('{{email}}', recipient.email)
          .replaceAll('{{first_name}}', (recipient.name || recipient.email).split(' ')[0])
          .replaceAll('{{unsubscribe_url}}', `${Deno.env.get('PUBLIC_SITE_URL') || ''}/unsubscribe?email=${encodeURIComponent(recipient.email)}`),
        trackingBase,
        sendId,
        recipientEmail: recipient.email,
        campaignId: campaign.id,
      });

      const provider = getProvider(providerName);
      const { messageId } = await provider({
        from,
        to: recipient.email,
        subject: campaign.subject,
        html,
      });

      sent += 1;
      await supabase.from('email_sends').update({
        status: 'sent',
        provider: providerName,
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
      }).eq('id', sendId);
    } catch (err) {
      failed += 1;
      messages.push(`Failed to send to ${recipient.email}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  messages.push(`Campaign ${campaign.id} (${campaign.name}): ${sent} sent, ${suppressed} suppressed, ${failed} failed (${recipients.length} total)`);
  return { sent, suppressed, failed, messages };
}

async function processBroadcast({
  supabase, broadcast, providerName, dryRun,
}: {
  supabase: ReturnType<typeof createClient>;
  broadcast: EmailBroadcast;
  providerName: string;
  dryRun: boolean;
}): Promise<{ sent: number; suppressed: number; failed: number; messages: string[] }> {
  const messages: string[] = [];

  if (dryRun) {
    messages.push(`Dry run: ${broadcast.subject} would send through ${providerName} to ${broadcast.recipient_count} recipients.`);
    return { sent: 1, suppressed: 0, failed: 0, messages };
  }

  const adapter = getProvider(providerName);
  const from = Deno.env.get('EMAIL_FROM');
  const to = Deno.env.get('EMAIL_TEST_RECIPIENT');

  if (!from || !to) {
    throw new Error('Missing EMAIL_FROM or EMAIL_TEST_RECIPIENT for legacy broadcast send');
  }

  const { messageId } = await adapter({
    from,
    to,
    subject: broadcast.subject,
    html: broadcast.body,
  });

  await supabase.from('email_sends').insert({
    recipient_email: to,
    subject_snapshot: broadcast.subject,
    body_snapshot: broadcast.body,
    status: 'sent',
    provider: providerName,
    provider_message_id: messageId,
    sent_at: new Date().toISOString(),
  });

  messages.push(`Sent legacy broadcast ${broadcast.id} (${broadcast.subject}) to test recipient`);
  return { sent: 1, suppressed: 0, failed: 0, messages };
}

async function resolveAudience(
  supabase: ReturnType<typeof createClient>,
  audienceKey: string,
): Promise<{ email: string; name?: string }[]> {
  switch (audienceKey) {
    case 'all-customers': {
      const { data } = await supabase
        .from('orders')
        .select('purchaser_email, purchaser_name')
        .eq('status', 'paid');
      const seen = new Set<string>();
      return (data || [])
        .filter((r) => {
          const email = (r.purchaser_email || '').toLowerCase();
          if (!email || seen.has(email)) return false;
          seen.add(email);
          return true;
        })
        .map((r) => ({ email: r.purchaser_email!.toLowerCase(), name: r.purchaser_name || undefined }));
    }
    case 'upcoming-attendees': {
      const { data } = await supabase
        .from('orders')
        .select('purchaser_email, purchaser_name, event:events(start_datetime)')
        .eq('status', 'paid')
        .gte('event.start_datetime', new Date().toISOString());
      const seen = new Set<string>();
      return (data || [])
        .filter((r) => {
          const email = (r.purchaser_email || '').toLowerCase();
          if (!email || seen.has(email)) return false;
          seen.add(email);
          return true;
        })
        .map((r) => ({ email: r.purchaser_email!.toLowerCase(), name: r.purchaser_name || undefined }));
    }
    case 'newsletter-active': {
      const { data } = await supabase
        .from('newsletter_subscribers')
        .select('email, name')
        .eq('is_active', true);
      return (data || []).map((r) => ({ email: r.email.toLowerCase(), name: r.name || undefined }));
    }
    case 'gift-card-holders': {
      const { data } = await supabase
        .from('gift_cards')
        .select('purchaser_email, purchaser_name, recipient_email, recipient_name')
        .eq('is_redeemed', false);
      const seen = new Set<string>();
      const results: { email: string; name?: string }[] = [];
      for (const card of data || []) {
        const email = (card.purchaser_email || '').toLowerCase();
        if (email && !seen.has(email)) {
          seen.add(email);
          results.push({ email, name: card.purchaser_name || undefined });
        }
        const remail = (card.recipient_email || '').toLowerCase();
        if (remail && !seen.has(remail)) {
          seen.add(remail);
          results.push({ email: remail, name: card.recipient_name || undefined });
        }
      }
      return results;
    }
    default:
      return [];
  }
}

async function getSuppressedEmails(
  supabase: ReturnType<typeof createClient>,
  emails: string[],
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const { data } = await supabase
    .from('email_suppression_list')
    .select('email');
  return new Set((data || []).map((r) => r.email.toLowerCase()));
}

function getProvider(name: string): ProviderAdapter {
  switch (name) {
    case 'resend':
      return sendViaResend;
    case 'sendgrid':
      return sendViaSendGrid;
    case 'smtp':
      return sendViaSmtp;
    default:
      throw new Error(`Unknown provider: ${name}. Supported: resend, sendgrid, smtp`);
  }
}

async function sendViaResend({ from, to, subject, html }: Parameters<ProviderAdapter>[0]) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { messageId: String(data.id ?? '') };
}

async function sendViaSendGrid({ from, to, subject, html }: Parameters<ProviderAdapter>[0]) {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) throw new Error('Missing SENDGRID_API_KEY');

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${text}`);
  }

  return { messageId: response.headers.get('x-message-id') || '' };
}

async function sendViaSmtp({ from, to, subject, html }: Parameters<ProviderAdapter>[0]) {
  const host = Deno.env.get('SMTP_HOST');
  const port = Deno.env.get('SMTP_PORT');
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');

  if (!host || !port || !username || !password) {
    throw new Error('Missing SMTP_HOST, SMTP_PORT, SMTP_USERNAME, or SMTP_PASSWORD');
  }

  // Use a basic SMTP send via a relay endpoint or embedded Deno SMTP library
  const response = await fetch(`https://${host}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMTP relay error ${response.status}: ${text}`);
  }

  return { messageId: `smtp-${Date.now()}` };
}

type InjectOpts = {
  html: string;
  trackingBase: string;
  sendId: string;
  recipientEmail: string;
  campaignId?: string;
};

function injectTracking(opts: InjectOpts): string {
  const pixelUrl = `${opts.trackingBase}?action=open&send_id=${opts.sendId}&email=${encodeURIComponent(opts.recipientEmail)}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

  // Wrap all <a href="..."> links with tracking redirect
  const wrapped = opts.html.replaceAll(/<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi, (match, before, url, after) => {
    const trackUrl = `${opts.trackingBase}?action=click&send_id=${opts.sendId}&email=${encodeURIComponent(opts.recipientEmail)}&url=${encodeURIComponent(url)}`;
    return `<a ${before}href="${trackUrl}"${after}>`;
  });

  // Insert pixel before closing body tag, or append if no body tag
  if (wrapped.includes('</body>')) {
    return wrapped.replace('</body>', `${pixel}\n</body>`);
  }
  return wrapped + pixel;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
