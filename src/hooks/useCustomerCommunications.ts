import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type CommunicationChannel = 'email' | 'sms';

export interface CommunicationEntry {
  id: string;
  channel: CommunicationChannel;
  subject: string | null;
  preview: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

export interface CustomerCommunications {
  entries: CommunicationEntry[];
  emailCount: number;
  smsCount: number;
  backendConnected: boolean;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Loads a unified, time-sorted communication history (emails + SMS) for a
 * single customer, keyed by email and/or phone.
 */
export function useCustomerCommunications(email?: string | null, phone?: string | null) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedPhone = (phone || '').replace(/[^\d+]/g, '');

  return useQuery({
    queryKey: ['customer-communications', normalizedEmail, normalizedPhone],
    enabled: Boolean(normalizedEmail || normalizedPhone),
    queryFn: async (): Promise<CustomerCommunications> => {
      const entries: CommunicationEntry[] = [];
      let backendConnected = true;
      let emailCount = 0;
      let smsCount = 0;

      if (normalizedEmail) {
        const { data, error } = await supabase
          .from('email_sends')
          .select('id, subject_snapshot, body_snapshot, status, sent_at, created_at')
          .ilike('recipient_email', normalizedEmail)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          backendConnected = false;
        } else {
          emailCount = (data || []).length;
          for (const row of data || []) {
            const r = row as Record<string, unknown>;
            entries.push({
              id: `email-${String(r.id)}`,
              channel: 'email',
              subject: r.subject_snapshot ? String(r.subject_snapshot) : null,
              preview: stripHtml(String(r.body_snapshot ?? '')).slice(0, 140),
              status: String(r.status ?? 'unknown'),
              sentAt: r.sent_at ? String(r.sent_at) : null,
              createdAt: String(r.created_at ?? new Date().toISOString()),
            });
          }
        }
      }

      if (normalizedPhone) {
        const { data, error } = await supabase
          .from('sms_messages')
          .select('id, body_snapshot, status, sent_at, created_at, recipient_phone')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error) {
          const matching = (data || []).filter((row) => {
            const r = row as Record<string, unknown>;
            return String(r.recipient_phone ?? '').replace(/[^\d+]/g, '') === normalizedPhone;
          });
          smsCount = matching.length;
          for (const row of matching) {
            const r = row as Record<string, unknown>;
            entries.push({
              id: `sms-${String(r.id)}`,
              channel: 'sms',
              subject: null,
              preview: String(r.body_snapshot ?? '').slice(0, 140),
              status: String(r.status ?? 'unknown'),
              sentAt: r.sent_at ? String(r.sent_at) : null,
              createdAt: String(r.created_at ?? new Date().toISOString()),
            });
          }
        }
      }

      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      return { entries, emailCount, smsCount, backendConnected };
    },
    staleTime: 1000 * 60,
  });
}
