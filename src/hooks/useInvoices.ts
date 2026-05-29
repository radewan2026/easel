import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { Invoice, InvoiceLineItem } from '../types/database';

export function useInvoices(filters?: { status?: string; corporate_account_id?: string }) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      let query = supabase.from('invoices').select('*, corporate_account:corporate_accounts(*)').order('created_at', { ascending: false });
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.corporate_account_id) query = query.eq('corporate_account_id', filters.corporate_account_id);
      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*, corporate_account:corporate_accounts(*)').eq('id', id).single();
      if (error) throw error;
      return data as Invoice;
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      const { data, error } = await supabase.from('invoices').insert(invoice).select().single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'invoice.created', entityType: 'invoice', entityId: vars.id, entityName: `Invoice for ${vars.corporate_account_id}` });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useApproveAndSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('stripe-invoice', {
        body: { invoice_id: id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useVoidInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('invoices').update({ status: 'voided' }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRecalculateInvoice() {
  return useMutation({
    mutationFn: async ({ id, lineItems }: { id: string; lineItems: InvoiceLineItem[] }) => {
      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const { data, error } = await supabase.from('invoices').update({
        line_items: lineItems,
        subtotal,
        total_amount: subtotal,
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
  });
}