import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rollup computes daily aggregates from analytics_events into analytics_daily_rollups.
// Deploy as a scheduled function: supabase functions deploy analytics-rollup
// Then set cron: https://supabase.com/docs/guides/functions/schedule-functions

interface RollupEntry {
  date: string;
  metric_name: string;
  dimension: string;
  dimension_value: string;
  count: number;
}

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

  const url = new URL(req.url);
  const targetDate = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const fullRollup = url.searchParams.get('full') === 'true';

  // If full=true, roll up for last 90 days
  const dates = fullRollup ? getLast90Days() : [targetDate];

  const results: { date: string; metrics: number }[] = [];

  for (const date of dates) {
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    // Fetch all events for this date
    const { data: events } = await supabase
      .from('analytics_events')
      .select('event_name, anonymous_id, session_id, user_type, properties')
      .gte('occurred_at', start)
      .lte('occurred_at', end);

    if (!events || events.length === 0) continue;

    // Build rollup entries
    const entries: RollupEntry[] = [];

    // Metric: page_views
    const pageViews = events.filter((e) => e.event_name === 'page_view');
    entries.push({ date, metric_name: 'page_views', dimension: 'all', dimension_value: 'all', count: pageViews.length });

    // Metric: unique_visitors
    const uniqueIds = new Set<string>();
    for (const e of events) {
      if (e.anonymous_id) uniqueIds.add(e.anonymous_id);
    }
    entries.push({ date, metric_name: 'unique_visitors', dimension: 'all', dimension_value: 'all', count: uniqueIds.size });

    // Metric: unique_sessions
    const uniqueSessions = new Set<string>();
    for (const e of events) {
      if (e.session_id) uniqueSessions.add(e.session_id);
    }
    entries.push({ date, metric_name: 'unique_sessions', dimension: 'all', dimension_value: 'all', count: uniqueSessions.size });

    // Metric: checkouts
    const checkoutStarts = events.filter((e) => e.event_name === 'checkout_start').length;
    const checkoutCompletions = events.filter((e) => e.event_name === 'checkout_complete').length;
    const checkoutAbandons = events.filter((e) => e.event_name === 'checkout_abandoned').length;
    entries.push({ date, metric_name: 'checkout_starts', dimension: 'all', dimension_value: 'all', count: checkoutStarts });
    entries.push({ date, metric_name: 'checkout_completions', dimension: 'all', dimension_value: 'all', count: checkoutCompletions });
    entries.push({ date, metric_name: 'checkout_abandons', dimension: 'all', dimension_value: 'all', count: checkoutAbandons });

    // Metric: conversions
    const conversions = events.filter((e) => e.event_name === 'checkout_complete' || e.event_name === 'private_request_complete').length;
    entries.push({ date, metric_name: 'conversions', dimension: 'all', dimension_value: 'all', count: conversions });

    // Metric: revenue (from checkout_complete events with totalAmount)
    let revenue = 0;
    for (const e of events) {
      if (e.event_name === 'checkout_complete') {
        const props = (e.properties || {}) as Record<string, unknown>;
        revenue += Number(props.totalAmount || props.total_amount || 0);
      }
    }
    entries.push({ date, metric_name: 'revenue', dimension: 'all', dimension_value: 'all', count: Math.round(revenue * 100) });

    // Metric: by_source
    const sourceCount: Record<string, number> = {};
    const sourceRevenue: Record<string, number> = {};
    for (const e of events) {
      const props = (e.properties || {}) as Record<string, unknown>;
      const att = (props.attribution || {}) as Record<string, unknown>;
      const source = String(att.source || 'Direct / unknown');
      sourceCount[source] = (sourceCount[source] || 0) + 1;
      if (e.event_name === 'checkout_complete') {
        sourceRevenue[source] = (sourceRevenue[source] || 0) + Number(props.totalAmount || props.total_amount || 0);
      }
    }
    for (const [source, count] of Object.entries(sourceCount)) {
      entries.push({ date, metric_name: 'events_by_source', dimension: 'source', dimension_value: source, count });
    }
    for (const [source, rev] of Object.entries(sourceRevenue)) {
      entries.push({ date, metric_name: 'revenue_by_source', dimension: 'source', dimension_value: source, count: Math.round(rev * 100) });
    }

    // Metric: by_event_name
    const eventCounts: Record<string, number> = {};
    for (const e of events) {
      eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
    }
    for (const [name, count] of Object.entries(eventCounts)) {
      entries.push({ date, metric_name: 'events_by_name', dimension: 'event_name', dimension_value: name, count });
    }

    // Metric: by_user_type
    const userTypeCounts: Record<string, number> = {};
    for (const e of events) {
      userTypeCounts[e.user_type] = (userTypeCounts[e.user_type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(userTypeCounts)) {
      entries.push({ date, metric_name: 'events_by_user_type', dimension: 'user_type', dimension_value: type, count });
    }

    // Upsert all rollup entries
    let upserted = 0;
    for (const entry of entries) {
      const { error } = await supabase
        .from('analytics_daily_rollups')
        .upsert(entry, { onConflict: 'date,metric_name,dimension,dimension_value' });
      if (!error) upserted += 1;
    }

    results.push({ date, metrics: upserted });
  }

  return json({ rolledUp: true, dates: results });
});

function getLast90Days(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
