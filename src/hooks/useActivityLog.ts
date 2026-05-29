import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ActivityLogEntry } from '../types/database';

export function useActivityLog(filters?: {
  entityType?: string;
  actorId?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['activityLog', filters],
    queryFn: async () => {
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }

      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLogEntry[];
    },
  });
}

export function useActivityLogCount() {
  return useQuery({
    queryKey: ['activityLogCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });
}
