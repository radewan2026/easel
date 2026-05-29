import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { PrivateEventRequest, PrivateRequestStatus } from '../types/database';

export function usePrivateEventRequests(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['private-event-requests', filters],
    queryFn: async () => {
      let query = supabase.from('private_event_requests').select('*, venue:venues(*), painting:gallery_images(*), corporate_account:corporate_accounts(*)').order('created_at', { ascending: false });
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data as PrivateEventRequest[];
    },
  });
}

export function usePrivateEventRequest(id: string) {
  return useQuery({
    queryKey: ['private-event-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('private_event_requests').select('*, venue:venues(*), painting:gallery_images(*), corporate_account:corporate_accounts(*)').eq('id', id).single();
      if (error) throw error;
      return data as PrivateEventRequest;
    },
    enabled: !!id,
  });
}

export function useSubmitPrivateEventRequest() {
  return useMutation({
    mutationFn: async (request: Partial<PrivateEventRequest>) => {
      const { data, error } = await supabase.from('private_event_requests').insert(request).select().single();
      if (error) throw error;
      return data as PrivateEventRequest;
    },
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: PrivateRequestStatus; adminNotes?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (adminNotes !== undefined) updates.admin_notes = adminNotes;
      const { data, error } = await supabase.from('private_event_requests').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as PrivateEventRequest;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'private_request.status_changed', entityType: 'private_event_request', entityId: vars.id, details: { status: vars.status } });
      queryClient.invalidateQueries({ queryKey: ['private-event-requests'] });
    },
  });
}

export function useConvertToEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, eventData }: { requestId: string; eventData: Record<string, unknown> }) => {
      const { data: event, error: eventError } = await supabase.from('events').insert(eventData).select().single();
      if (eventError) throw eventError;

      const { error: updateError } = await supabase.from('private_event_requests').update({ status: 'converted_to_event' }).eq('id', requestId);
      if (updateError) throw updateError;

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function usePaintableImages() {
  return useQuery({
    queryKey: ['paintable-images'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gallery_images').select('*, gallery:galleries(*)').eq('paintable', true).order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}