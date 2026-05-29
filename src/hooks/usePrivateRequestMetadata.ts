import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';

const SETTINGS_KEY = 'private_request_metadata';

export type PrivateRequestMetadata = {
  estimatedValue?: number;
  nextFollowUpDate?: string;
  assignedOwnerId?: string;
  assignedOwnerName?: string;
  qualification?: 'new' | 'needs_info' | 'qualified' | 'not_fit';
  proposalStatus?: 'not_started' | 'drafted' | 'sent' | 'accepted' | 'expired';
  depositStatus?: 'not_requested' | 'requested' | 'paid' | 'waived';
  depositAmount?: number;
  proposalSentDate?: string;
  proposalExpiresDate?: string;
  packageInterest?: string;
  probability?: number;
  source?: string;
};

export type PrivateRequestMetadataMap = Record<string, PrivateRequestMetadata>;

export function usePrivateRequestMetadata() {
  return useQuery({
    queryKey: ['private-request-metadata'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
      if (error) throw error;
      if (!data?.value) return {} as PrivateRequestMetadataMap;
      if (typeof data.value === 'string') {
        try {
          return JSON.parse(data.value) as PrivateRequestMetadataMap;
        } catch {
          return {} as PrivateRequestMetadataMap;
        }
      }
      return data.value as PrivateRequestMetadataMap;
    },
  });
}

export function useUpdatePrivateRequestMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, metadata }: { requestId: string; metadata: PrivateRequestMetadata }) => {
      const current = (queryClient.getQueryData(['private-request-metadata']) || {}) as PrivateRequestMetadataMap;
      const next = {
        ...current,
        [requestId]: {
          ...(current[requestId] || {}),
          ...metadata,
        },
      };
      const { data, error } = await supabase
        .from('settings')
        .upsert({ key: SETTINGS_KEY, value: next }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        action: 'private_request.metadata_updated',
        entityType: 'private_request',
        entityId: requestId,
        details: { metadata },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-request-metadata'] });
    },
  });
}
