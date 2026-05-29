import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TimeEntry } from '../types/database';

export function useTimeEntries(filters?: {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: ['timeEntries', filters],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*, account:accounts(id, name, email, role, hourly_rate, overtime_multiplier)')
        .order('clock_in', { ascending: false });

      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }
      if (filters?.dateFrom) {
        query = query.gte('clock_in', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('clock_in', filters.dateTo + 'T23:59:59');
      }
      if (filters?.isActive) {
        query = query.is('clock_out', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

export function useActiveEntry(accountId?: string) {
  return useQuery({
    queryKey: ['activeTimeEntry', accountId],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*, account:accounts(id, name, email, role, hourly_rate, overtime_multiplier)')
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1);

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as TimeEntry[])?.[0] || null;
    },
    refetchInterval: 30000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, notes, latitude, longitude }: { accountId: string; notes?: string; latitude?: number | null; longitude?: number | null }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          account_id: accountId,
          clock_in: new Date().toISOString(),
          notes: notes || null,
          is_manual: false,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        })
        .select('*, account:accounts(id, name, email, role, hourly_rate, overtime_multiplier)')
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeEntry'] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const update: Record<string, unknown> = {
        clock_out: new Date().toISOString(),
      };
      if (notes !== undefined) update.notes = notes;

      const { data, error } = await supabase
        .from('time_entries')
        .update(update)
        .eq('id', id)
        .select('*, account:accounts(id, name, email, role, hourly_rate, overtime_multiplier)')
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeEntry'] });
    },
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      accountId: string;
      clockIn: string;
      clockOut?: string;
      hours?: number;
      notes?: string;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      const insert: Record<string, unknown> = {
        account_id: entry.accountId,
        clock_in: entry.clockIn,
        clock_out: entry.clockOut || null,
        hours: entry.hours || null,
        notes: entry.notes || null,
        is_manual: true,
        latitude: entry.latitude ?? null,
        longitude: entry.longitude ?? null,
      };
      const { data, error } = await supabase
        .from('time_entries')
        .insert(insert)
        .select('*, account:accounts(id, name, email, role, hourly_rate, overtime_multiplier)')
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeEntry'] });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TimeEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update(updates)
        .eq('id', id)
        .select('*, account:accounts(id, name, email, role, hourly_rate, overtime_multiplier)')
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeEntry'] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeEntry'] });
    },
  });
}

export function getEntryHours(entry: TimeEntry): number {
  if (entry.hours != null) return entry.hours;
  if (!entry.clock_out) return 0;
  const start = new Date(entry.clock_in).getTime();
  const end = new Date(entry.clock_out).getTime();
  return Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;
}

export function calculatePay(
  entries: TimeEntry[],
  overtimeThreshold: number = 40,
): { regularHours: number; overtimeHours: number; regularPay: number; overtimePay: number; totalPay: number } {
  let totalHours = 0;
  entries.forEach((e) => {
    totalHours += getEntryHours(e);
  });
  totalHours = Math.round(totalHours * 100) / 100;

  const regularHours = Math.min(totalHours, overtimeThreshold);
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold);
  const rate = entries[0]?.account?.hourly_rate || 0;
  const multiplier = entries[0]?.account?.overtime_multiplier || 1.5;

  const regularPay = Math.round(regularHours * rate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * rate * multiplier * 100) / 100;
  const totalPay = Math.round((regularPay + overtimePay) * 100) / 100;

  return { regularHours, overtimeHours, regularPay, overtimePay, totalPay };
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  });
}

export function formatLocation(entry: TimeEntry): string | null {
  if (entry.latitude == null || entry.longitude == null) return null;
  return `${entry.latitude.toFixed(6)}, ${entry.longitude.toFixed(6)}`;
}

export function getMapUrl(entry: TimeEntry): string | null {
  if (entry.latitude == null || entry.longitude == null) return null;
  return `https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`;
}