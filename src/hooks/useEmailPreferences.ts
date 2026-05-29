import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type CustomerEmailPreferences = {
  email: string;
  transactionalEnabled: boolean;
  marketingEnabled: boolean;
  privateEventUpdatesEnabled: boolean;
  membershipUpdatesEnabled: boolean;
  updatedAt: string;
  source: 'backend' | 'local';
};

const defaultPreferences = (email: string): CustomerEmailPreferences => ({
  email,
  transactionalEnabled: true,
  marketingEnabled: true,
  privateEventUpdatesEnabled: true,
  membershipUpdatesEnabled: true,
  updatedAt: new Date().toISOString(),
  source: 'local',
});

const storageKey = (email: string) => `easel_email_preferences_${email.trim().toLowerCase()}`;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readLocalPreferences(email: string) {
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? JSON.parse(raw) as CustomerEmailPreferences : null;
  } catch {
    return null;
  }
}

function writeLocalPreferences(preferences: CustomerEmailPreferences) {
  localStorage.setItem(storageKey(preferences.email), JSON.stringify(preferences));
}

function isMissingTable(error: unknown) {
  const backendError = error as { code?: string; message?: string; details?: string } | null;
  const message = `${backendError?.message || ''} ${backendError?.details || ''}`.toLowerCase();
  return backendError?.code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function shouldUseEmailPreferencesBackend() {
  return import.meta.env.VITE_EMAIL_PREFERENCES_BACKEND_ENABLED === 'true';
}

export function useEmailPreferences(email?: string) {
  const normalizedEmail = email ? normalizeEmail(email) : '';

  return useQuery({
    queryKey: ['email-preferences', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async () => {
      const local = readLocalPreferences(normalizedEmail);
      if (!shouldUseEmailPreferencesBackend()) {
        return local || defaultPreferences(normalizedEmail);
      }

      const { data, error } = await supabase
        .from('customer_email_preferences')
        .select('*')
        .ilike('customer_email', normalizedEmail)
        .maybeSingle();

      if (!error && data) {
        return {
          email: normalizedEmail,
          transactionalEnabled: data.transactional_enabled !== false,
          marketingEnabled: data.marketing_enabled !== false,
          privateEventUpdatesEnabled: data.private_event_updates_enabled !== false,
          membershipUpdatesEnabled: data.membership_updates_enabled !== false,
          updatedAt: data.updated_at || new Date().toISOString(),
          source: 'backend' as const,
        };
      }

      if (error && !isMissingTable(error)) {
        console.warn('Email preference backend unavailable:', error.message);
      }

      return local || defaultPreferences(normalizedEmail);
    },
  });
}

export function useSaveEmailPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Omit<CustomerEmailPreferences, 'updatedAt' | 'source'>) => {
      const normalizedEmail = normalizeEmail(preferences.email);
      const next: CustomerEmailPreferences = {
        ...preferences,
        email: normalizedEmail,
        updatedAt: new Date().toISOString(),
        source: 'local',
      };

      writeLocalPreferences(next);

      await supabase
        .from('newsletter_subscribers')
        .upsert({
          email: normalizedEmail,
          source: 'preference_center',
          is_active: preferences.marketingEnabled,
        }, { onConflict: 'email' });

      if (shouldUseEmailPreferencesBackend()) {
        const { error } = await supabase
          .from('customer_email_preferences')
          .upsert({
            customer_email: normalizedEmail,
            transactional_enabled: preferences.transactionalEnabled,
            marketing_enabled: preferences.marketingEnabled,
            private_event_updates_enabled: preferences.privateEventUpdatesEnabled,
            membership_updates_enabled: preferences.membershipUpdatesEnabled,
            unsubscribed_at: preferences.marketingEnabled ? null : new Date().toISOString(),
            source: 'preference_center',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'customer_email' });

        if (error && !isMissingTable(error)) {
          console.warn('Email preference table unavailable:', error.message);
        }

        if (!preferences.marketingEnabled) {
          const { error: suppressionError } = await supabase
            .from('email_suppression_list')
            .upsert({
              email: normalizedEmail,
              reason: 'unsubscribe',
              notes: 'Customer updated preferences',
            }, { onConflict: 'email,reason' });
          if (suppressionError && !isMissingTable(suppressionError)) {
            console.warn('Email suppression table unavailable:', suppressionError.message);
          }
        }
      }

      return next;
    },
    onSuccess: (preferences) => {
      queryClient.invalidateQueries({ queryKey: ['email-preferences', preferences.email] });
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}
