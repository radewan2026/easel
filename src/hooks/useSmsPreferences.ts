import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SmsPreferences {
  customerPhone: string;
  transactionalEnabled: boolean;
  marketingEnabled: boolean;
  appointmentRemindersEnabled: boolean;
  optedOutAt: string | null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function useSmsPreferences(phone?: string | null) {
  const normalized = normalizePhone(phone || '');

  return useQuery({
    queryKey: ['sms-preferences', normalized],
    enabled: Boolean(normalized),
    queryFn: async (): Promise<SmsPreferences> => {
      const { data, error } = await supabase
        .from('customer_sms_preferences')
        .select('*')
        .eq('customer_phone', normalized)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return {
          customerPhone: normalized,
          transactionalEnabled: true,
          marketingEnabled: false,
          appointmentRemindersEnabled: true,
          optedOutAt: null,
        };
      }

      const r = data as Record<string, unknown>;
      return {
        customerPhone: String(r.customer_phone),
        transactionalEnabled: Boolean(r.transactional_enabled),
        marketingEnabled: Boolean(r.marketing_enabled),
        appointmentRemindersEnabled: Boolean(r.appointment_reminders_enabled),
        optedOutAt: r.opted_out_at ? String(r.opted_out_at) : null,
      };
    },
  });
}

export interface UpdateSmsPreferencesInput {
  phone: string;
  marketingEnabled?: boolean;
  appointmentRemindersEnabled?: boolean;
  source?: string;
}

export function useUpdateSmsPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSmsPreferencesInput) => {
      const normalized = normalizePhone(input.phone);
      const payload: Record<string, unknown> = {
        customer_phone: normalized,
        source: input.source || 'account_page',
        updated_at: new Date().toISOString(),
      };
      if (input.marketingEnabled !== undefined) {
        payload.marketing_enabled = input.marketingEnabled;
        payload.opted_out_at = input.marketingEnabled ? null : new Date().toISOString();
      }
      if (input.appointmentRemindersEnabled !== undefined) {
        payload.appointment_reminders_enabled = input.appointmentRemindersEnabled;
      }

      const { data, error } = await supabase
        .from('customer_sms_preferences')
        .upsert(payload, { onConflict: 'customer_phone' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['sms-preferences', normalizePhone(input.phone)] });
    },
  });
}
