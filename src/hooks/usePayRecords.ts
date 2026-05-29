import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PayRecord } from '../types/database';

export function usePayRecords(filters?: { status?: string; employee_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['pay-records', filters],
    queryFn: async () => {
      let query = supabase.from('pay_records').select('*, employee:employees(*), event:events(*), assignment:event_assignments(*)').order('created_at', { ascending: false });
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
      const { data, error } = await query;
      if (error) throw error;
      return data as PayRecord[];
    },
  });
}

export function useApprovePayRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('pay_records').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-records'] });
    },
  });
}

export function useUpdatePayRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PayRecord> & { id: string }) => {
      if (updates.pay_amount && !updates.pay_override) {
        const { data: record } = await supabase.from('pay_records').select('hours_worked, hourly_rate').eq('id', id).single();
        if (record) {
          const computed = Number(record.hours_worked) * Number(record.hourly_rate);
          updates.pay_override = Math.abs(Number(updates.pay_amount) - computed) > 0.01;
        }
      }
      const { data, error } = await supabase.from('pay_records').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-records'] });
    },
  });
}

export function useDispatchPayRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('stripe-transfer', {
        body: { pay_record_ids: [id] },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-records'] });
    },
  });
}

export function useBulkDispatchPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payRecordIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('stripe-transfer', {
        body: { pay_record_ids: payRecordIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-records'] });
    },
  });
}

export function useRetryFailedPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('pay_records').update({
        status: 'approved',
        stripe_error: null,
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-records'] });
    },
  });
}

export function usePayHistory(filters?: { employee_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['pay-history', filters],
    queryFn: async () => {
      let query = supabase.from('pay_records').select('*, employee:employees(*), event:events(*)').eq('status', 'paid').order('paid_at', { ascending: false });
      if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
      const { data, error } = await query;
      if (error) throw error;
      return data as PayRecord[];
    },
  });
}
