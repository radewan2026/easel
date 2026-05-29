import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const dryRun = Deno.env.get('EMAIL_DRY_RUN') !== 'false';
  const payload = await req.json().catch(() => null);
  if (!payload?.to || !payload?.subject || !payload?.html) {
    return json({ error: 'Missing to, subject, or html' }, 400);
  }

  if (dryRun) {
    return json({
      dryRun: true,
      accepted: true,
      message: `Dry run: test email would send to ${payload.to}`,
    });
  }

  const provider = payload.provider || Deno.env.get('EMAIL_PROVIDER') || 'resend';
  if (provider !== 'resend') {
    return json({ error: `Provider ${provider} is not implemented for test sends yet` }, 400);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) {
    return json({ error: 'Missing RESEND_API_KEY or EMAIL_FROM' }, 500);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: `[TEST] ${payload.subject}`,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    return json({ error: await response.text() }, response.status);
  }

  return json({ accepted: true, dryRun: false, provider: 'resend' });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
