import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Submission, SubmissionStatus } from '../types/database';

export function useSubmissions() {
  return useQuery({
    queryKey: ['submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('useSubmissions error:', error);
        throw error;
      }
      return data as Submission[];
    },
    staleTime: 0,
  });
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: async (submission: {
      name: string;
      email: string;
      phone?: string;
      event_type?: string;
      preferred_date?: string;
      preferred_time?: string;
      group_size?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('submissions')
        .insert(submission)
        .select()
        .single();
      if (error) throw error;
      return data as Submission;
    },
  });
}

export function useUpdateSubmissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SubmissionStatus }) => {
      const { data, error } = await supabase
        .from('submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Submission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
}

export function useDeleteSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
}
