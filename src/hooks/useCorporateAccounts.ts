import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { CorporateAccount } from '../types/database';

export function useCorporateAccounts(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['corporate-accounts', filters],
    queryFn: async () => {
      let query = supabase.from('corporate_accounts').select('*').order('company_name');
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.search) query = query.or(`company_name.ilike.%${filters.search}%,primary_contact_name.ilike.%${filters.search}%,primary_contact_email.ilike.%${filters.search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as CorporateAccount[];
    },
  });
}

export function useCorporateAccount(id: string) {
  return useQuery({
    queryKey: ['corporate-accounts', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('corporate_accounts').select('*').eq('id', id).single();
      if (error) throw error;
      return data as CorporateAccount;
    },
    enabled: !!id,
  });
}

export function useCreateCorporateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Partial<CorporateAccount>) => {
      const { data, error } = await supabase.from('corporate_accounts').insert(account).select().single();
      if (error) throw error;
      return data as CorporateAccount;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'corporate_account.created', entityType: 'corporate_account', entityId: vars.id, entityName: vars.company_name });
      queryClient.invalidateQueries({ queryKey: ['corporate-accounts'] });
    },
  });
}

export function useUpdateCorporateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CorporateAccount> & { id: string }) => {
      const { data, error } = await supabase.from('corporate_accounts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as CorporateAccount;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'corporate_account.updated', entityType: 'corporate_account', entityId: vars.id, entityName: vars.company_name });
      queryClient.invalidateQueries({ queryKey: ['corporate-accounts'] });
    },
  });
}

export function useDeactivateCorporateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('corporate_accounts').update({ status: 'inactive' }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-accounts'] });
    },
  });
}

export function useCorporateAccountEvents(accountId: string) {
  return useQuery({
    queryKey: ['corporate-account-events', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('private_event_requests').select('*, venue:venues(*)').eq('corporate_account_id', accountId).eq('status', 'converted_to_event');
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
}

export function useCorporateAccountInvoices(accountId: string) {
  return useQuery({
    queryKey: ['corporate-account-invoices', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('corporate_account_id', accountId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
}