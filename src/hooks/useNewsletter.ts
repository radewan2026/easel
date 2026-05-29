import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { NewsletterSubscriber } from '../types/database';

export function useSubscribers() {
  return useQuery({
    queryKey: ['subscribers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NewsletterSubscriber[];
    },
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, name, source }: { email: string; name?: string; source?: string }) => {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email: email.toLowerCase(), name: name || null, source: source || 'footer' }, { onConflict: 'email' })
        .select()
        .single();
      if (error) throw error;
      return data as NewsletterSubscriber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}

export function useDeleteSubscriber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}

export function useUnsubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .update({ is_active: false })
        .eq('email', email.toLowerCase());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}
