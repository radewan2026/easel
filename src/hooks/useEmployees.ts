import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { Employee, AdminRole, EmployeePermissions } from '../types/database';

export function useEmployees(filters?: { status?: string; role?: string; search?: string }) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: async () => {
      let query = supabase.from('employees').select('*').order('name');
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.role) query = query.eq('role', filters.role);
      if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Employee;
    },
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (employee: Partial<Employee>) => {
      const { data, error } = await supabase.from('employees').insert(employee).select().single();
      if (error) throw error;
      return data as Employee;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'employee.created', entityType: 'employee', entityId: vars.id, entityName: vars.name });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Employee> & { id: string }) => {
      const { data, error } = await supabase.from('employees').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Employee;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'employee.updated', entityType: 'employee', entityId: vars.id, entityName: vars.name });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('employees').update({ status: 'inactive' }).eq('id', id).select().single();
      if (error) throw error;
      return data as Employee;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'employee.deactivated', entityType: 'employee', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useEmployeeStats(id: string) {
  return useQuery({
    queryKey: ['employee-stats', id],
    queryFn: async () => {
      const [assignmentsRes, payRes] = await Promise.all([
        supabase.from('event_assignments').select('id, status, hours_worked').eq('employee_id', id).eq('status', 'completed'),
        supabase.from('pay_records').select('pay_amount, status').eq('employee_id', id),
      ]);

      const assignments = assignmentsRes.data || [];
      const payRecords = payRes.data || [];

      const totalEvents = assignments.length;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [monthAssignmentsRes] = await Promise.all([
        supabase.from('event_assignments').select('id, hours_worked').eq('employee_id', id).eq('status', 'completed').gte('clock_in', monthStart),
      ]);
      const monthAssignments = monthAssignmentsRes?.data || [];

      const totalHours = assignments.reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);
      const monthHours = monthAssignments.reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);
      const avgHours = totalEvents > 0 ? totalHours / totalEvents : 0;
      const totalPayEarned = payRecords.reduce((sum, p) => sum + Number(p.pay_amount), 0);
      const totalPaid = payRecords.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.pay_amount), 0);
      const outstanding = payRecords.filter(p => p.status === 'approved').reduce((sum, p) => sum + Number(p.pay_amount), 0);
      const declined = (assignmentsRes.data || []).filter(a => a.status === 'declined').length;

      return {
        totalEvents,
        eventsThisMonth: monthAssignments.length,
        totalHours: Math.round(totalHours * 100) / 100,
        hoursThisMonth: Math.round(monthHours * 100) / 100,
        avgHoursPerEvent: Math.round(avgHours * 100) / 100,
        totalPayEarned,
        totalPaid,
        outstanding,
        declined,
      };
    },
    enabled: !!id,
  });
}

export function useCreateStripeConnectAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, email }: { employeeId: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-account', {
        body: { employee_id: employeeId, email },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useGenerateOnboardingLink() {
  return useMutation({
    mutationFn: async ({ stripeAccountId }: { stripeAccountId: string }) => {
      const { data, error } = await supabase.functions.invoke('stripe-onboarding-link', {
        body: { stripe_account_id: stripeAccountId },
      });
      if (error) throw error;
      return data as { url: string };
    },
  });
}

export function useSetEmployeePassword() {
  return useMutation({
    mutationFn: async ({ employeeId, password }: { employeeId: string; password: string }) => {
      const { error } = await supabase.rpc('set_employee_password', {
        p_employee_id: employeeId,
        p_password: password,
      });
      if (error) throw error;
    },
  });
}

export function useCreateEmployeeAuthUser() {
  return useMutation({
    mutationFn: async ({ employeeId, email, password }: { employeeId: string; email: string; password: string }) => {
      const { error } = await supabase.rpc('create_admin_auth_user', {
        employee_id: employeeId,
        email,
        password,
      });
      if (error) throw error;
    },
  });
}

export function useUpdateEmployeeAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, adminRole, permissions }: { id: string; adminRole: AdminRole; permissions?: EmployeePermissions }) => {
      const updates: Partial<Employee> & { admin_role: AdminRole } = { admin_role: adminRole };
      if (adminRole === 'none') {
        updates.password_hash = null;
        updates.permissions = null;
      } else if (permissions !== undefined) {
        updates.permissions = adminRole === 'admin' ? null : permissions;
      }
      const { data, error } = await supabase.from('employees').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useEmployeesWithAdmin() {
  return useQuery({
    queryKey: ['employees-with-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .neq('admin_role', 'none')
        .order('name');
      if (error) throw error;
      return data as Employee[];
    },
  });
}