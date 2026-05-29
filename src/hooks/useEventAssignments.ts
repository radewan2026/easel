import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { EventAssignment } from '../types/database';

export function useEventAssignments(filters?: { event_id?: string; employee_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['event-assignments', filters],
    queryFn: async () => {
      let query = supabase.from('event_assignments').select('*, employee:employees(*), event:events(*)').order('assigned_at', { ascending: false });
      if (filters?.event_id) query = query.eq('event_id', filters.event_id);
      if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data as EventAssignment[];
    },
  });
}

export function useAssignEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: { event_id: string; employee_id: string; notes?: string }) => {
      const { data, error } = await supabase.from('event_assignments').insert({
        ...assignment,
        status: 'assigned',
      }).select('*, employee:employees(*)').single();
      if (error) throw error;
      return data as EventAssignment;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'assignment.created', entityType: 'event_assignment', entityId: vars.event_id, details: { employeeId: vars.employee_id } });
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
    },
  });
}

export function useUnassignEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
    },
  });
}

export function useConfirmAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('event_assignments').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
    },
  });
}

export function useDeclineAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('event_assignments').update({ status: 'declined' }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
    },
  });
}

export function useMarkComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, clockIn, clockOut, notes, hourlyRateSnapshot }: {
      assignmentId: string;
      clockIn: string;
      clockOut: string;
      notes?: string;
      hourlyRateSnapshot: number;
    }) => {
      const clockInDate = new Date(clockIn);
      const clockOutDate = new Date(clockOut);
      const hoursRaw = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
      const hoursWorked = Math.round(hoursRaw * 4) / 4;
      const payAmount = hoursWorked * hourlyRateSnapshot;

      const { data: assignment, error: assignmentError } = await supabase.from('event_assignments').update({
        status: 'completed',
        clock_in: clockIn,
        clock_out: clockOut,
        hours_worked: hoursWorked,
        hourly_rate_snapshot: hourlyRateSnapshot,
        pay_amount: payAmount,
        pay_override: false,
        notes: notes || null,
      }).eq('id', assignmentId).select('*, employee:employees(*), event:events(*)').single();

      if (assignmentError) throw assignmentError;

      const { data: payRecord, error: payError } = await supabase.from('pay_records').insert({
        event_assignment_id: assignmentId,
        employee_id: assignment.employee_id,
        event_id: assignment.event_id,
        hours_worked: hoursWorked,
        hourly_rate: hourlyRateSnapshot,
        pay_amount: payAmount,
        pay_override: false,
        status: 'pending',
      }).select().single();

      if (payError) throw payError;

      return { assignment, payRecord };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['pay-records'] });
    },
  });
}

export function useEmployeeWorkload(employeeId: string) {
  return useQuery({
    queryKey: ['employee-workload', employeeId],
    queryFn: async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [weekRes, monthRes] = await Promise.all([
        supabase.from('event_assignments').select('hours_worked').eq('employee_id', employeeId).neq('status', 'declined').gte('assigned_at', weekStart.toISOString()),
        supabase.from('event_assignments').select('hours_worked').eq('employee_id', employeeId).neq('status', 'declined').gte('assigned_at', monthStart.toISOString()),
      ]);

      const weekHours = (weekRes.data || []).reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);
      const monthHours = (monthRes.data || []).reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);

      return { weekHours: Math.round(weekHours * 100) / 100, monthHours: Math.round(monthHours * 100) / 100 };
    },
    enabled: !!employeeId,
  });
}