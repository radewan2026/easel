import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { SmsMessage, SmsTemplate, SmsTemplateType } from '../components/admin/email/emailUtils';

export interface SmsPerformance {
  sent30d: number;
  delivered30d: number;
  failed30d: number;
  optedOut: number;
  deliveryRate: number;
}

export interface SmsCenterData {
  templates: SmsTemplate[];
  recentMessages: SmsMessage[];
  performance: SmsPerformance;
  optInCount: number;
  suppressionCount: number;
  backendConnected: boolean;
}

function mapTemplate(row: Record<string, unknown>): SmsTemplate {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    templateType: (String(row.template_type ?? 'transactional')) as SmsTemplateType,
    triggerName: String(row.trigger_name ?? 'manual'),
    body: String(row.body ?? ''),
    isActive: Boolean(row.is_active),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapMessage(row: Record<string, unknown>): SmsMessage {
  return {
    id: String(row.id),
    recipientPhone: String(row.recipient_phone ?? ''),
    recipientName: row.recipient_name ? String(row.recipient_name) : null,
    bodySnapshot: String(row.body_snapshot ?? ''),
    status: (String(row.status ?? 'queued')) as SmsMessage['status'],
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    failedReason: row.failed_reason ? String(row.failed_reason) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function useSmsCenter() {
  return useQuery({
    queryKey: ['sms-center'],
    queryFn: async (): Promise<SmsCenterData> => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [templatesResult, messagesResult, prefsResult, suppressResult] = await Promise.all([
        supabase.from('sms_templates').select('*').order('updated_at', { ascending: false }),
        supabase.from('sms_messages').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('customer_sms_preferences').select('id').eq('marketing_enabled', true),
        supabase.from('sms_suppression_list').select('id'),
      ]);

      const backendConnected = !templatesResult.error;

      const templates = (templatesResult.data || []).map((r) => mapTemplate(r as Record<string, unknown>));
      const recentMessages = (messagesResult.data || []).map((r) => mapMessage(r as Record<string, unknown>));

      const last30 = recentMessages.filter((m) => m.createdAt >= cutoff);
      const sent30d = last30.filter((m) => ['sent', 'delivered'].includes(m.status)).length;
      const delivered30d = last30.filter((m) => m.status === 'delivered').length;
      const failed30d = last30.filter((m) => ['failed', 'bounced'].includes(m.status)).length;

      return {
        templates,
        recentMessages,
        performance: {
          sent30d,
          delivered30d,
          failed30d,
          optedOut: last30.filter((m) => m.status === 'opted_out').length,
          deliveryRate: sent30d ? Math.round((delivered30d / sent30d) * 100) : 0,
        },
        optInCount: (prefsResult.data || []).length,
        suppressionCount: (suppressResult.data || []).length,
        backendConnected,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface SaveSmsTemplateInput {
  id?: string;
  name: string;
  templateType: SmsTemplateType;
  triggerName: string;
  body: string;
  isActive: boolean;
}

export function useSaveSmsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveSmsTemplateInput) => {
      const payload = {
        name: input.name,
        template_type: input.templateType,
        trigger_name: input.triggerName,
        body: input.body,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      };

      if (input.id) {
        const { data, error } = await supabase
          .from('sms_templates')
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('sms_templates')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, input) => {
      await logActivity({
        action: input.id ? 'sms.template_updated' : 'sms.template_created',
        entityType: 'sms',
        entityName: input.name,
      });
      queryClient.invalidateQueries({ queryKey: ['sms-center'] });
    },
  });
}

export function useDeleteSmsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sms_templates').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await logActivity({ action: 'sms.template_deleted', entityType: 'sms', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['sms-center'] });
    },
  });
}

export interface SendSmsInput {
  templateId?: string;
  body?: string;
  recipients: string[];
  audienceKey?: string;
  campaignName?: string;
}

export function useSendSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendSmsInput) => {
      const { data, error } = await supabase.functions.invoke('sms-worker', {
        body: {
          templateId: input.templateId,
          body: input.body,
          recipients: input.recipients,
          audience_key: input.audienceKey,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, input) => {
      await logActivity({
        action: 'sms.campaign_sent',
        entityType: 'sms',
        entityName: input.campaignName || 'SMS send',
        details: { recipientCount: input.recipients.length, audience: input.audienceKey },
      });
      queryClient.invalidateQueries({ queryKey: ['sms-center'] });
    },
  });
}
