import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { Event, Venue, EventImage, Coupon, Order, OrderStatus, EmailBroadcast } from '../types/database';

type EventRecurrence = {
  type?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  end_date?: string;
  count?: number;
};

export function useEvents(filters?: { venueId?: string; published?: boolean }) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .eq('is_deleted', false)
        .order('start_datetime', { ascending: true });

      if (filters?.venueId) {
        query = query.eq('venue_id', filters.venueId);
      }
      if (filters?.published !== undefined) {
        query = query.eq('is_published', filters.published);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
      return data as Event[];
    },
    staleTime: 0,
  });
}

export function useEvent(slug: string) {
  return useQuery({
    queryKey: ['event', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) {
        console.error('useEvent error:', error);
        return null;
      }
      return data as Event;
    },
  });
}

export function useEventImages(eventId: string) {
  return useQuery({
    queryKey: ['eventImages', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_images')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as EventImage[];
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: Partial<Event>) => {
      const { data, error } = await supabase.from('events').insert(event).select().single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: (_, event) => {
      logActivity({ action: 'event.created', entityType: 'event', entityId: event.id, entityName: event.title });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export async function generateRecurringEvents(eventData: Partial<Event>) {
  const recurrence = eventData.recurrence as EventRecurrence | null | undefined;
  if (!recurrence || !recurrence.type) {
    const { data, error } = await supabase.from('events').insert(eventData).select().single();
    if (error) throw error;
    return [data];
  }

  const eventsToCreate: Partial<Event>[] = [];
  const startDate = new Date(eventData.start_datetime!);
  const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;
  const maxCount = recurrence.count || 10;
  const eventEnd = eventData.end_datetime ? new Date(eventData.end_datetime) : null;
  const duration = eventEnd ? eventEnd.getTime() - startDate.getTime() : 0;

  let count = 0;
  let currentDate = new Date(startDate);

  while (count < maxCount) {
    if (endDate && currentDate > endDate) break;

    eventsToCreate.push({
      ...eventData,
      start_datetime: currentDate.toISOString(),
      end_datetime: duration ? new Date(currentDate.getTime() + duration).toISOString() : null,
      slug: `${eventData.slug}-${count + 1}`,
      recurrence: recurrence,
    });

    count++;

    switch (recurrence.type) {
      case 'daily':
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'biweekly':
        currentDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      default:
        break;
    }
  }

  const { data, error } = await supabase.from('events').insert(eventsToCreate).select();
  if (error) throw error;
  return data;
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...event }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from('events')
        .update(event)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'event.updated', entityType: 'event', entityId: vars.id, entityName: vars.title });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'event.deleted', entityType: 'event', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useTrashEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'event.deleted', entityType: 'event', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['trashedEvents'] });
    },
  });
}

export function useRestoreEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').update({ is_deleted: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'event.updated', entityType: 'event', entityId: id, details: { note: 'restored from trash' } });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['trashedEvents'] });
    },
  });
}

export function usePermanentDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashedEvents'] });
    },
  });
}

export function useTrashedEvents() {
  return useQuery({
    queryKey: ['trashedEvents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_deleted', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });
}

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Venue[];
    },
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venue: Partial<Venue>) => {
      const { data, error } = await supabase.from('venues').insert(venue).select().single();
      if (error) throw error;
      return data as Venue;
    },
    onSuccess: (_, venue) => {
      logActivity({ action: 'venue.created', entityType: 'venue', entityId: venue.id, entityName: venue.name });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...venue }: Partial<Venue> & { id: string }) => {
      const { data, error } = await supabase
        .from('venues')
        .update(venue)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Venue;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'venue.updated', entityType: 'venue', entityId: vars.id, entityName: vars.name });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useDeleteVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('venues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'venue.deleted', entityType: 'venue', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useTrashVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('venues').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'venue.deleted', entityType: 'venue', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      queryClient.invalidateQueries({ queryKey: ['trashedVenues'] });
    },
  });
}

export function useRestoreVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('venues').update({ is_deleted: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'venue.updated', entityType: 'venue', entityId: id, details: { note: 'restored from trash' } });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      queryClient.invalidateQueries({ queryKey: ['trashedVenues'] });
    },
  });
}

export function usePermanentDeleteVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('venues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashedVenues'] });
    },
  });
}

export function useTrashedVenues() {
  return useQuery({
    queryKey: ['trashedVenues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_deleted', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Venue[];
    },
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });
}

export function useValidateCoupon(code: string, eventId?: string) {
  return useQuery({
    queryKey: ['coupon', code, eventId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_to', now)
        .single();
      if (error || !data) return null;
      if (data.max_uses && data.uses_so_far >= data.max_uses) return null;
      return data as Coupon;
    },
    enabled: !!code && code.length >= 3,
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (coupon: Partial<Coupon>) => {
      const { data, error } = await supabase.from('coupons').insert(coupon).select().single();
      if (error) throw error;
      return data as Coupon;
    },
    onSuccess: (_, coupon) => {
      logActivity({ action: 'coupon.created', entityType: 'coupon', entityId: coupon.id, entityName: coupon.code });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...coupon }: Partial<Coupon> & { id: string }) => {
      const { data, error } = await supabase
        .from('coupons')
        .update(coupon)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Coupon;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'coupon.updated', entityType: 'coupon', entityId: vars.id, entityName: vars.code });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });
}

export function useTrashCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'coupon.deleted', entityType: 'coupon', entityId: id });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.invalidateQueries({ queryKey: ['trashedCoupons'] });
    },
  });
}

export function useRestoreCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').update({ is_deleted: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      logActivity({ action: 'coupon.updated', entityType: 'coupon', entityId: id, details: { note: 'restored' } });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.invalidateQueries({ queryKey: ['trashedCoupons'] });
    },
  });
}

export function usePermanentDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashedCoupons'] });
    },
  });
}

export function useTrashedCoupons() {
  return useQuery({
    queryKey: ['trashedCoupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_deleted', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });
}

const mockOrders: Order[] = Array.from({ length: 15 }, (_, i) => {
  const numAttendees = [2, 4, 1, 3, 2, 6, 2, 4, 1, 3, 2, 5, 1, 2, 4][i];
  
  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'Tom', 'Emily', 'Chris', 'Amanda', 'David', 'Lisa', 'Kevin', 'Rachel', 'Brian', 'Stephanie', 'Jason'];
  const lastNames = ['Smith', 'Doe', 'Johnson', 'Williams', 'Brown', 'Davis', 'Wilson', 'Lee', 'Miller', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris'];
  
  const attendees = Array.from({ length: numAttendees }, (_, j) => {
    const firstName = firstNames[(i + j) % 15];
    const lastName = lastNames[(i + j) % 15];
    const phone = `(555) ${String(100 + (i * j) % 900).padStart(3, '0')}-${String(1000 + (i * j * 7) % 9000).slice(-4)}`;
    return {
      id: `att_${1000 + i}_${j}`,
      order_id: `ord_${1000 + i}`,
      full_name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      notes: phone,
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
  
  const purchaserName = attendees[0].full_name;
  const purchaserEmail = attendees[0].email;
  const eventId = `evt_${(i % 5) + 1}`;
  
  return {
    id: `ord_${1000 + i}`,
    event_id: eventId,
    coupon_id: null,
    purchaser_name: purchaserName,
    purchaser_email: purchaserEmail,
    purchaser_phone: attendees[0].notes,
    total_seats: numAttendees,
    subtotal_amount: [40, 80, 20, 60, 40, 120, 40, 80, 20, 60, 40, 100, 20, 40, 80][i],
    discount_amount: [0, 10, 0, 0, 5, 20, 0, 0, 0, 15, 0, 0, 0, 0, 10][i],
    total_amount: [40, 70, 20, 60, 35, 100, 40, 80, 20, 45, 40, 100, 20, 40, 70][i],
    status: ['paid', 'paid', 'paid', 'paid', 'pending', 'paid', 'cancelled', 'paid', 'paid', 'paid', 'refunded', 'paid', 'paid', 'paid', 'paid'][i] as 'pending' | 'paid' | 'cancelled' | 'refunded',
    refund_reason: null,
    refunded_at: null,
    created_at: new Date(Date.now() - (i * 2 + 1) * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    event: {
      id: eventId,
      title: ['Wine & Paint Night', 'Couples Painting', 'Beginner Workshop', 'Summer Sips', 'Art & Cocktails'][i % 5],
      slug: ['wine-paint-night', 'couples-painting', 'beginner-workshop', 'summer-sips', 'art-cocktails'][i % 5],
      description: null,
      start_datetime: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000).toISOString(),
      end_datetime: null,
      venue_id: null,
      base_price_per_seat: null,
      max_seats: null,
      seats_available: null,
      main_image_url: null,
      is_published: true,
      is_archived: false,
      recurrence: null,
      parent_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    attendees,
  };
});

export function useOrders(eventId?: string) {
  return useQuery({
    queryKey: ['orders', eventId],
    queryFn: async () => {
      try {
        let query = supabase
          .from('orders')
          .select('*, event:events(*), coupon:coupons(*), attendees:attendees(*)')
          .order('created_at', { ascending: false });

        if (eventId) {
          query = query.eq('event_id', eventId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Order[];
      } catch {
        return mockOrders;
      }
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: {
      eventId: string;
      purchaserName: string;
      purchaserEmail: string;
      purchaserPhone?: string;
      totalSeats: number;
      subtotalAmount: number;
      discountAmount: number;
      totalAmount: number;
      couponId?: string;
      status?: OrderStatus;
      attendees: { fullName: string; email?: string; notes?: string }[];
      membershipCreditsUsed?: number;
      membershipCreditValue?: number;
      customerEmail?: string;
    }) => {
      const shouldUseAtomicCheckout = Boolean(order.customerEmail && order.membershipCreditsUsed && order.membershipCreditsUsed > 0);

      if (shouldUseAtomicCheckout) {
        const { data, error } = await supabase.rpc('create_order_with_membership_credits', {
          p_event_id: order.eventId,
          p_purchaser_name: order.purchaserName,
          p_purchaser_email: order.purchaserEmail,
          p_purchaser_phone: order.purchaserPhone || null,
          p_total_seats: order.totalSeats,
          p_subtotal_amount: order.subtotalAmount,
          p_discount_amount: order.discountAmount,
          p_total_amount: order.totalAmount,
          p_status: order.status || 'pending',
          p_coupon_id: order.couponId || null,
          p_attendees: order.attendees,
          p_customer_email: order.customerEmail,
          p_membership_credits_used: order.membershipCreditsUsed || 0,
          p_membership_credit_value: order.membershipCreditValue || 0,
        });

        if (!error) {
          const rpcResult = Array.isArray(data) ? data[0] : data;
          return {
            order: rpcResult?.order || rpcResult,
            attendees: rpcResult?.attendees || [],
            membershipRedemption: rpcResult?.membershipRedemption || rpcResult?.membership_redemption || null,
            source: 'rpc',
          };
        }

        const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
        const rpcMissing = error.code === '42883' || message.includes('function') || message.includes('schema cache');
        if (!rpcMissing) throw error;
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          event_id: order.eventId,
          purchaser_name: order.purchaserName,
          purchaser_email: order.purchaserEmail,
          purchaser_phone: order.purchaserPhone,
          total_seats: order.totalSeats,
          subtotal_amount: order.subtotalAmount,
          discount_amount: order.discountAmount,
          total_amount: order.totalAmount,
          coupon_id: order.couponId,
          status: order.status || 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const { data: attendeesData, error: attendeesError } = await supabase
        .from('attendees')
        .insert(
          order.attendees.map((a) => ({
            order_id: orderData.id,
            full_name: a.fullName,
            email: a.email,
            notes: a.notes,
          }))
        )
        .select();

      if (attendeesError) throw attendeesError;

      await supabase.rpc('decrement_seats', { event_id: order.eventId, count: order.totalSeats });

      return { order: orderData, attendees: attendeesData, membershipRedemption: null, source: 'client' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Order;
    },
    onSuccess: (_, vars) => {
      const action = vars.status === 'cancelled' ? 'order.cancelled' : vars.status === 'refunded' ? 'order.refunded' : 'order.updated';
      logActivity({ action, entityType: 'order', entityId: vars.id });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRefundOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, notifyAttendee }: { id: string; reason: string; notifyAttendee: boolean }) => {
      const updateData: Record<string, unknown> = {
        status: 'refunded',
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (notifyAttendee) {
        const order = data as Order;
        await supabase.from('email_broadcasts').insert({
          event_id: order.event_id,
          subject: 'Refund Confirmation',
          body: `<p>Hi ${order.purchaser_name},</p><p>Your order has been refunded${reason ? ': ' + reason : ''}.</p><p>Amount: $${order.total_amount}</p><p>Thank you.</p>`,
          recipient_count: 1,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      }

      return data as Order;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'order.refunded', entityType: 'order', entityId: vars.id, details: { reason: vars.reason, notified: vars.notifyAttendee } });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useEmailBroadcasts(eventId: string) {
  return useQuery({
    queryKey: ['emailBroadcasts', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('email_broadcasts')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailBroadcast[];
    },
  });
}

export function useCreateEmailBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (broadcast: Partial<EmailBroadcast>) => {
      const { data, error } = await supabase
        .from('email_broadcasts')
        .insert(broadcast)
        .select()
        .single();
      if (error) throw error;
      return data as EmailBroadcast;
    },
    onSuccess: (_, broadcast) => {
      const action = broadcast.status === 'sent' ? 'email.sent' : 'email.updated';
      logActivity({ action, entityType: 'email', entityId: broadcast.id, entityName: broadcast.subject });
      queryClient.invalidateQueries({ queryKey: ['emailBroadcasts'] });
    },
  });
}

export function useUpdateEmailBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<EmailBroadcast>) => {
      const { data: result, error } = await supabase
        .from('email_broadcasts')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as EmailBroadcast;
    },
    onSuccess: (_, vars) => {
      logActivity({ action: 'email.updated', entityType: 'email', entityId: vars.id });
      queryClient.invalidateQueries({ queryKey: ['emailBroadcasts'] });
    },
  });
}

export function useDeleteEmailBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_broadcasts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailBroadcasts'] });
    },
  });
}

export function useEventAttendeeEmails(eventId: string) {
  return useQuery({
    queryKey: ['eventAttendeeEmails', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('attendees:attendees(email, full_name)')
        .eq('event_id', eventId)
        .eq('status', 'paid');
      if (error) throw error;
      const emails = new Set<string>();
      data?.forEach(order => {
        order.attendees?.forEach(a => {
          if (a.email) emails.add(a.email);
        });
      });
      return Array.from(emails);
    },
  });
}

export function useRescheduleEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      eventId: string;
      oldStartDatetime: string;
      newStartDatetime: string;
      newEndDatetime: string | null;
      notifyAttendees: boolean;
      customMessage: string;
      eventTitle: string;
    }) => {
      const updateData: Record<string, unknown> = {
        start_datetime: params.newStartDatetime,
        end_datetime: params.newEndDatetime,
      };
      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', params.eventId)
        .select()
        .single();
      if (error) throw error;

      if (params.notifyAttendees) {
        const { data: attendeeOrders } = await supabase
          .from('orders')
          .select('purchaser_name, purchaser_email')
          .eq('event_id', params.eventId)
          .eq('status', 'paid');

        const recipientCount = attendeeOrders?.length || 0;
        if (recipientCount > 0) {
          await supabase.from('email_broadcasts').insert({
            event_id: params.eventId,
            subject: `Schedule Change: ${params.eventTitle}`,
            body: `<p>Hi,</p><p>We wanted to let you know that <strong>${params.eventTitle}</strong> has been rescheduled.</p><p><strong>Old date:</strong> ${new Date(params.oldStartDatetime).toLocaleString()}</p><p><strong>New date:</strong> ${new Date(params.newStartDatetime).toLocaleString()}</p>${params.customMessage ? `<p>${params.customMessage}</p>` : ''}<p>We apologize for any inconvenience. See you there!</p>`,
            recipient_count: recipientCount,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
        }
      }

      return data as Event;
    },
    onSuccess: (_, params) => {
      logActivity({
        action: 'event.rescheduled',
        entityType: 'event',
        entityId: params.eventId,
        entityName: params.eventTitle,
        details: { oldDate: params.oldStartDatetime, newDate: params.newStartDatetime, notified: params.notifyAttendees },
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
}
