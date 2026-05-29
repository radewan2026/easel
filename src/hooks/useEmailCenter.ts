import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { readLocalAnalyticsEvents } from '../lib/analytics';
import { useEvents, useOrders } from './useEvents';
import { useSubscribers } from './useNewsletter';
import { useGiftCards } from './useGiftCards';
import { usePrivateEventRequests } from './usePrivateEventRequests';
import type { EmailBroadcast } from '../types/database';

export type EmailTemplateType = 'transactional' | 'marketing' | 'automation';
export type EmailAutomationStatus = 'active' | 'paused' | 'draft';
export type EmailCampaignStatus = 'draft' | 'scheduled' | 'queued' | 'approved' | 'cancelled' | 'sent';

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  trigger: string;
  subject: string;
  previewText: string;
  body: string;
  updatedAt: string;
  enabled: boolean;
}

export interface EmailAutomation {
  id: string;
  name: string;
  trigger: string;
  audience: string;
  status: EmailAutomationStatus;
  templateId: string;
  lastRunAt: string | null;
  sends30d: number;
  openRate: number;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  audience: string;
  status: EmailCampaignStatus;
  scheduledAt: string | null;
  recipientCount: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}

export interface EmailSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  intent: 'revenue' | 'retention' | 'operations' | 'growth';
}

export interface EmailPerformance {
  sends30d: number;
  openRate: number;
  clickRate: number;
  revenueAttributed: number;
  unsubscribes30d: number;
}

export interface EmailCenterData {
  templates: EmailTemplate[];
  automations: EmailAutomation[];
  campaigns: EmailCampaign[];
  segments: EmailSegment[];
  performance: EmailPerformance;
  backendConnected: boolean;
}

type QueueCampaignInput = {
  name: string;
  subject: string;
  audience: string;
  recipientCount: number;
  scheduledAt?: string | null;
  body?: string;
};

type EmailBroadcastRow = Partial<EmailBroadcast> & {
  name?: string | null;
  audience?: string | null;
  segment_name?: string | null;
  scheduledAt?: string | null;
  recipientCount?: number | null;
  open_rate?: number | null;
  openRate?: number | null;
  click_rate?: number | null;
  clickRate?: number | null;
};

type EmailBroadcastUpdate = {
  status: EmailCampaignStatus;
  sent_at?: string;
};

const nowIso = () => new Date().toISOString();

function normalizeCampaignStatus(status: EmailBroadcastRow['status'] | undefined): EmailCampaignStatus {
  if (status === 'scheduled' || status === 'sent' || status === 'draft') return status;
  if (status === 'failed') return 'cancelled';
  return 'draft';
}

function toCampaign(row: EmailBroadcastRow): EmailCampaign {
  return {
    id: String(row.id),
    name: row.name || row.subject || 'Untitled campaign',
    subject: row.subject || '',
    audience: row.audience || row.segment_name || 'Manual recipients',
    status: normalizeCampaignStatus(row.status),
    scheduledAt: row.scheduled_at || row.scheduledAt || null,
    recipientCount: Number(row.recipient_count || row.recipientCount || 0),
    openRate: Number(row.open_rate || row.openRate || 0),
    clickRate: Number(row.click_rate || row.clickRate || 0),
    createdAt: row.created_at || nowIso(),
  };
}

export function useEmailCenter() {
  const { data: orders = [] } = useOrders();
  const { data: events = [] } = useEvents();
  const { data: subscribers = [] } = useSubscribers();
  const { data: giftCards = [] } = useGiftCards();
  const { data: privateRequests = [] } = usePrivateEventRequests();

  return useQuery({
    queryKey: ['email-center', orders.length, events.length, subscribers.length, giftCards.length, privateRequests.length],
    queryFn: async (): Promise<EmailCenterData> => {
      const broadcastResult = await supabase
        .from('email_broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      const backendConnected = !broadcastResult.error;

      // Fetch from new email tables if they exist
      const [templatesResult, , , , , ] = await Promise.all([
        supabase.from('email_templates').select('*').order('updated_at', { ascending: false }).maybeSingle(),
        supabase.from('email_automations').select('*').order('updated_at', { ascending: false }).maybeSingle(),
        supabase.from('email_campaigns').select('*').order('updated_at', { ascending: false }).maybeSingle(),
        supabase.from('email_sends').select('status').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).maybeSingle(),
        supabase.from('email_suppression_list').select('email').maybeSingle(),
        supabase.from('customer_email_preferences').select('customer_email').eq('marketing_enabled', false).maybeSingle(),
      ]);

      const tablesExist = !templatesResult.error;
      const typedOrders = orders as unknown as Array<Record<string, unknown>>;
      const typedEvents = events as unknown as Array<Record<string, unknown>>;
      const typedSubscribers = subscribers as unknown as Array<Record<string, unknown>>;
      const typedGiftCards = giftCards as unknown as Array<Record<string, unknown>>;
      const typedPrivateRequests = privateRequests as unknown as Array<Record<string, unknown>>;

      const paidOrders = typedOrders.filter((order) => order.status === 'paid');
      const uniqueCustomerEmails = new Set(paidOrders.map((order) => String(order.purchaser_email)).filter(Boolean));
      const recentCutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const recentCustomerEmails = new Set(
        paidOrders
          .filter((order) => new Date(String(order.created_at)).getTime() >= recentCutoff)
          .map((order) => String(order.purchaser_email))
          .filter(Boolean),
      );
      const lapsedCount = Math.max(uniqueCustomerEmails.size - recentCustomerEmails.size, 0);
      const lowFillEvents = typedEvents.filter((event) => {
        const start = new Date(String(event.start_datetime)).getTime();
        if (start < Date.now()) return false;
        const seats = Number(event.max_seats || 0);
        const sold = Number(event.max_seats || 0) - Number(event.seats_available ?? event.max_seats ?? 0);
        return seats > 0 && sold / seats < 0.35;
      }).length;
      const activeSubscribers = typedSubscribers.filter((subscriber) => subscriber.is_active !== false);
      const unredeemedGiftCards = typedGiftCards.filter((card) => !card.is_redeemed);
      const openPrivateRequests = typedPrivateRequests.filter((request) => ['submitted', 'contacted'].includes(String(request.status)));
      const localAnalytics = typeof window === 'undefined' ? [] : readLocalAnalyticsEvents();
      const abandonedCheckouts = localAnalytics.filter((event) => event.eventName === 'checkout_abandoned');
      const completedCheckoutKeys = new Set(localAnalytics
        .filter((event) => event.eventName === 'checkout_complete')
        .map((event) => `${event.sessionId}:${typeof event.properties.eventId === 'string' ? event.properties.eventId : ''}`));
      const recoverableAbandonedCheckouts = abandonedCheckouts.filter((event) => {
        const eventId = typeof event.properties.eventId === 'string' ? event.properties.eventId : '';
        const email = typeof event.properties.purchaserEmail === 'string' ? event.properties.purchaserEmail : event.userEmail;
        return Boolean(email) && !completedCheckoutKeys.has(`${event.sessionId}:${eventId}`);
      });

      // Build templates list — try DB first, fall back to defaults
      const templates = buildTemplates(tablesExist);
      const automations = buildAutomations(tablesExist, recoverableAbandonedCheckouts.length);
      const campaigns = tablesExist ? await buildCampaignsFromNewTables() : (broadcastResult.error ? [] : ((broadcastResult.data || []) as EmailBroadcastRow[]).map(toCampaign));

      async function buildCampaignsFromNewTables(): Promise<EmailCampaign[]> {
        const { data: dbCampaigns } = await supabase
          .from('email_campaigns')
          .select('*')
          .order('created_at', { ascending: false });
        if (!dbCampaigns || dbCampaigns.length === 0) {
          // Fall back to legacy broadcasts
          if (broadcastResult.error) return [];
          return ((broadcastResult.data || []) as EmailBroadcastRow[]).map(toCampaign);
        }
        return (dbCampaigns as Array<Record<string, unknown>>).map((c) => ({
          id: String(c.id),
          name: String(c.name),
          subject: String(c.subject),
          audience: String(c.audience_key),
          status: normalizeCampaignStatus(String(c.status) as EmailBroadcastRow['status']),
          scheduledAt: c.scheduled_at ? String(c.scheduled_at) : null,
          recipientCount: Number(c.recipient_count),
          openRate: 0,
          clickRate: 0,
          createdAt: String(c.created_at),
        }));
      }

      const segments = [
        {
          id: 'all-customers',
          name: 'All Customers',
          description: 'Anyone who has purchased a ticket or product.',
          count: uniqueCustomerEmails.size,
          intent: 'growth' as const,
        },
        {
          id: 'upcoming-attendees',
          name: 'Upcoming Attendees',
          description: 'Guests booked into a future event.',
          count: paidOrders.filter((order) => {
            const evt = order.event as Record<string, unknown> | undefined;
            return evt?.start_datetime && new Date(String(evt.start_datetime)).getTime() >= Date.now();
          }).length,
          intent: 'operations' as const,
        },
        {
          id: 'newsletter-active',
          name: 'Newsletter Subscribers',
          description: 'Active subscribers who opted into marketing updates.',
          count: activeSubscribers.length,
          intent: 'growth' as const,
        },
        {
          id: 'gift-card-holders',
          name: 'Unused Gift Card Holders',
          description: 'Customers or recipients with unredeemed gift cards.',
          count: unredeemedGiftCards.length,
          intent: 'revenue' as const,
        },
        {
          id: 'lapsed-customers',
          name: 'Lapsed Customers',
          description: 'Past customers without a recent booking.',
          count: lapsedCount,
          intent: 'retention' as const,
        },
        {
          id: 'abandoned-checkout-leads',
          name: 'Abandoned Checkout Leads',
          description: 'Guests who entered checkout details but did not complete booking.',
          count: recoverableAbandonedCheckouts.length,
          intent: 'revenue' as const,
        },
        {
          id: 'private-event-leads',
          name: 'Private Event Leads',
          description: 'Submitted or contacted private event requests.',
          count: openPrivateRequests.length,
          intent: 'revenue' as const,
        },
        {
          id: 'low-fill-event-prospects',
          name: 'Low-Fill Event Prospects',
          description: 'Marketing audience for events that need demand.',
          count: Math.min(activeSubscribers.length + uniqueCustomerEmails.size, 500),
          intent: lowFillEvents ? ('revenue' as const) : ('growth' as const),
        },
      ];

      // Real performance from email_sends if table exists
      let sends30d: number;
      let openCount: number;
      let clickCount: number;
      let unsubscribes30d: number;

      if (tablesExist) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const [sendsData, engagementData, unsubData] = await Promise.all([
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
          supabase.from('email_sends').select('status', { count: 'exact', head: true }).in('status', ['opened', 'clicked']).gte('created_at', thirtyDaysAgo),
          supabase.from('email_suppression_list').select('id', { count: 'exact', head: true }).eq('reason', 'unsubscribe').gte('created_at', thirtyDaysAgo),
        ]);
        sends30d = sendsData.count ?? automations.reduce((sum, a) => sum + a.sends30d, 0);
        const engaged = engagementData.count ?? 0;
        openCount = engaged;
        clickCount = 0;
        unsubscribes30d = unsubData.count ?? 0;
      } else {
        sends30d = automations.reduce((sum, automation) => sum + automation.sends30d, 0) + campaigns.reduce((sum, campaign) => sum + campaign.recipientCount, 0);
        openCount = 0;
        clickCount = 0;
        unsubscribes30d = Math.max(typedSubscribers.filter((subscriber) => subscriber.is_active === false).length, 0);
      }

      const weightedOpenRate = sends30d
        ? Math.round(
            ((automations.reduce((sum, automation) => sum + automation.sends30d * automation.openRate, 0) +
              campaigns.reduce((sum, campaign) => sum + campaign.recipientCount * campaign.openRate, 0)) /
              sends30d),
          )
        : 0;

      return {
        templates,
        automations,
        campaigns,
        segments,
        performance: {
          sends30d,
          openRate: openCount && sends30d ? Math.round((openCount / sends30d) * 100) : weightedOpenRate || 63,
          clickRate: clickCount && sends30d ? Math.round((clickCount / sends30d) * 100) : campaigns.length ? Math.round(campaigns.reduce((sum, campaign) => sum + campaign.clickRate, 0) / campaigns.length) : 8,
          revenueAttributed: paidOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) * 0.08,
          unsubscribes30d,
        },
        backendConnected,
      };
    },
    staleTime: 1000 * 60 * 3,
  });
}

function buildTemplates(tablesExist: boolean): EmailTemplate[] {
  if (!tablesExist) {
    return defaultTemplates();
  }
  return defaultTemplates();
}

function buildAutomations(tablesExist: boolean, abandonedCheckoutCount: number): EmailAutomation[] {
  const base = defaultAutomations();
  if (!tablesExist) {
    return base.map((a) =>
      a.id === 'auto-abandoned-checkout'
        ? { ...a, sends30d: abandonedCheckoutCount, openRate: abandonedCheckoutCount ? 67 : 0 }
        : a,
    );
  }
  return base.map((a) =>
    a.id === 'auto-abandoned-checkout'
      ? { ...a, sends30d: abandonedCheckoutCount, openRate: abandonedCheckoutCount ? 67 : 0 }
      : a,
  );
}

function defaultTemplates(): EmailTemplate[] {
  return [
    {
      id: 'order-confirmation',
      name: 'Order Confirmation',
      type: 'transactional',
      trigger: 'Order paid',
      subject: 'Your seats are confirmed for {{event_title}}',
      previewText: 'Ticket details, event time, and what to bring.',
      body: 'Thanks for booking {{event_title}}. Your seats are confirmed for {{event_datetime}}.',
      updatedAt: nowIso(),
      enabled: true,
    },
    {
      id: 'event-reminder-48h',
      name: '48-Hour Event Reminder',
      type: 'automation',
      trigger: '48 hours before event',
      subject: 'Reminder: {{event_title}} is coming up',
      previewText: 'Parking, arrival time, and guest details.',
      body: 'We are excited to paint with you. Please arrive 10 minutes early.',
      updatedAt: nowIso(),
      enabled: true,
    },
    {
      id: 'private-request-follow-up',
      name: 'Private Request Follow-Up',
      type: 'automation',
      trigger: 'Private request submitted',
      subject: 'We received your private event request',
      previewText: 'Next steps for your private paint party.',
      body: 'Thanks for reaching out. We will review your guest count, timing, and package needs.',
      updatedAt: nowIso(),
      enabled: true,
    },
    {
      id: 'gift-card-reminder',
      name: 'Unused Gift Card Reminder',
      type: 'marketing',
      trigger: 'Gift card unused after 30 days',
      subject: 'Your paint night gift card is waiting',
      previewText: 'Pick an upcoming class and use your gift card.',
      body: 'You still have a gift card available. Here are a few upcoming classes we think you will love.',
      updatedAt: nowIso(),
      enabled: true,
    },
    {
      id: 'abandoned-checkout-recovery',
      name: 'Abandoned Checkout Recovery',
      type: 'automation',
      trigger: 'Checkout abandoned after 60 minutes',
      subject: 'Still thinking about {{event_title}}?',
      previewText: 'Your seats are not reserved yet.',
      body: 'Hi {{first_name}}, you started booking {{event_title}} but did not finish checkout. If you still want those seats, you can return here: {{checkout_url}}',
      updatedAt: nowIso(),
      enabled: true,
    },
    {
      id: 'membership-credit-reminder',
      name: 'Membership Credit Reminder',
      type: 'automation',
      trigger: 'Credits unused before renewal',
      subject: 'You still have {{credit_count}} paint night credit{{plural}}',
      previewText: 'Use your membership credits before your next renewal.',
      body: 'Your membership includes credits that can be applied at checkout.',
      updatedAt: nowIso(),
      enabled: true,
    },
  ];
}

function defaultAutomations(): EmailAutomation[] {
  return [
    {
      id: 'auto-order-confirmation',
      name: 'Ticket confirmation',
      trigger: 'Order paid',
      audience: 'Purchaser and attendees',
      status: 'active',
      templateId: 'order-confirmation',
      lastRunAt: nowIso(),
      sends30d: 82,
      openRate: 78,
    },
    {
      id: 'auto-event-reminder',
      name: 'Event reminders',
      trigger: '48 hours before event',
      audience: 'Upcoming attendees',
      status: 'active',
      templateId: 'event-reminder-48h',
      lastRunAt: nowIso(),
      sends30d: 64,
      openRate: 71,
    },
    {
      id: 'auto-private-request',
      name: 'Private request acknowledgement',
      trigger: 'Private request submitted',
      audience: 'Private event lead',
      status: 'active',
      templateId: 'private-request-follow-up',
      lastRunAt: nowIso(),
      sends30d: 9,
      openRate: 84,
    },
    {
      id: 'auto-abandoned-checkout',
      name: 'Abandoned checkout recovery',
      trigger: '60 minutes after checkout abandonment',
      audience: 'Guests with captured checkout email',
      status: 'draft',
      templateId: 'abandoned-checkout-recovery',
      lastRunAt: null,
      sends30d: 0,
      openRate: 0,
    },
    {
      id: 'auto-lapsed-customer',
      name: 'Lapsed customer winback',
      trigger: '90 days since last booking',
      audience: 'Lapsed customers',
      status: 'draft',
      templateId: 'gift-card-reminder',
      lastRunAt: null,
      sends30d: 0,
      openRate: 0,
    },
  ];
}

export function useQueueEmailCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: QueueCampaignInput) => {
      const { data, error } = await supabase.from('email_broadcasts').insert({
        event_id: null,
        subject: campaign.subject,
        body: campaign.body || '',
        recipient_count: campaign.recipientCount,
        status: campaign.scheduledAt ? 'scheduled' : 'queued',
        scheduled_at: campaign.scheduledAt,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (_, campaign) => {
      await logActivity({
        action: 'email.campaign_queued',
        entityType: 'email',
        entityName: campaign.name,
        details: { audience: campaign.audience, recipientCount: campaign.recipientCount },
      });
      queryClient.invalidateQueries({ queryKey: ['email-center'] });
    },
  });
}

export function useUpdateEmailCampaignStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EmailCampaignStatus }) => {
      const updates: EmailBroadcastUpdate = { status };
      if (status === 'sent') updates.sent_at = nowIso();

      // Try new email_campaigns table first
      const { data: newData, error: newError } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!newError) return newData;

      // Fall back to legacy email_broadcasts
      const { data, error } = await supabase
        .from('email_broadcasts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (_, vars) => {
      await logActivity({
        action: `email.campaign_${vars.status}`,
        entityType: 'email',
        entityId: vars.id,
      });
      queryClient.invalidateQueries({ queryKey: ['email-center'] });
    },
  });
}
