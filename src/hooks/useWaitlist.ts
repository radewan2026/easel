import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WaitlistEntry } from '../types/database';

export function useWaitlist(eventId?: string) {
  return useQuery({
    queryKey: ['waitlist', eventId],
    queryFn: async () => {
      let query = supabase.from('waitlist').select('*, event:events(id, title, start_datetime)').order('created_at', { ascending: false });
      if (eventId) query = query.eq('event_id', eventId);
      const { data, error } = await query;
      if (error) throw error;
      return data as WaitlistEntry[];
    },
    staleTime: 0,
  });
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { event_id: string; name: string; email: string; phone?: string; seats_desired?: number }) => {
      const { data, error } = await supabase.from('waitlist').insert(entry).select().single();
      if (error) throw error;
      return data as WaitlistEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useUpdateWaitlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WaitlistEntry> & { id: string }) => {
      const { data, error } = await supabase.from('waitlist').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as WaitlistEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useDeleteWaitlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('waitlist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}
