import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';

interface RevenueDataPoint {
  label: string;
  revenue: number;
  orders: number;
  seats: number;
}

interface VenueRevenue {
  venueId: string;
  venueName: string;
  revenue: number;
  orders: number;
  seats: number;
}

interface EventTypeRevenue {
  eventType: string;
  revenue: number;
  orders: number;
  seats: number;
}

type RevenueOrder = {
  id: string;
  total_amount: number | null;
  total_seats: number | null;
  created_at: string;
  event?: {
    id?: string | null;
    title?: string | null;
    venue_id?: string | null;
    venue?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
};

export interface RevenueAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalSeats: number;
  avgOrderValue: number;
  timeline: RevenueDataPoint[];
  byVenue: VenueRevenue[];
  byEvent: EventTypeRevenue[];
  period: RevenuePeriod;
}

export function useRevenueAnalytics(period: RevenuePeriod = 'weekly', dateRange?: { from: string; to: string }) {
  return useQuery({
    queryKey: ['revenueAnalytics', period, dateRange],
    queryFn: async (): Promise<RevenueAnalytics> => {
      const now = new Date();
      const from = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = dateRange?.to || now.toISOString();

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total_amount, total_seats, created_at, event:events(id, title, venue_id, venue:venues(id, name))')
        .eq('status', 'paid')
        .gte('created_at', from)
        .lte('created_at', to);

      if (error) throw error;

      const allOrders = (orders || []) as RevenueOrder[];
      const totalRevenue = allOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const totalOrders = allOrders.length;
      const totalSeats = allOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const timeline = buildTimeline(allOrders, period, from, to);

      const venueMap = new Map<string, { name: string; revenue: number; orders: number; seats: number }>();
      allOrders.forEach((o) => {
        const venueId = o.event?.venue?.id || o.event?.venue_id || 'unknown';
        const venueName = o.event?.venue?.name || 'Unknown Venue';
        const existing = venueMap.get(venueId) || { name: venueName, revenue: 0, orders: 0, seats: 0 };
        existing.revenue += Number(o.total_amount || 0);
        existing.orders += 1;
        existing.seats += o.total_seats || 0;
        venueMap.set(venueId, existing);
      });
      const byVenue = Array.from(venueMap.entries()).map(([venueId, v]) => ({
        venueId,
        venueName: v.name,
        ...v,
      }));

      const eventMap = new Map<string, { eventType: string; revenue: number; orders: number; seats: number }>();
      allOrders.forEach((o) => {
        const eventId = o.event?.id || 'unknown';
        const eventTitle = o.event?.title || 'Unknown Event';
        const existing = eventMap.get(eventId) || { eventType: eventTitle, revenue: 0, orders: 0, seats: 0 };
        existing.revenue += Number(o.total_amount || 0);
        existing.orders += 1;
        existing.seats += o.total_seats || 0;
        eventMap.set(eventId, existing);
      });
      const byEvent = Array.from(eventMap.values());

      return { totalRevenue, totalOrders, totalSeats, avgOrderValue, timeline, byVenue, byEvent, period };
    },
  });
}

function buildTimeline(orders: RevenueOrder[], period: RevenuePeriod, from: string, to: string): RevenueDataPoint[] {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const points: RevenueDataPoint[] = [];

  if (period === 'daily') {
    const current = new Date(fromDate);
    while (current <= toDate) {
      const dayStr = current.toISOString().slice(0, 10);
      const dayOrders = orders.filter(o => o.created_at.slice(0, 10) === dayStr);
      points.push({
        label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0),
        orders: dayOrders.length,
        seats: dayOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0),
      });
      current.setDate(current.getDate() + 1);
    }
  } else if (period === 'weekly') {
    const current = new Date(fromDate);
    current.setDate(current.getDate() - current.getDay());
    while (current <= toDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= current && d < weekEnd;
      });
      points.push({
        label: `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        revenue: weekOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0),
        orders: weekOrders.length,
        seats: weekOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0),
      });
      current.setDate(current.getDate() + 7);
    }
  } else {
    const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    while (current <= toDate) {
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const monthOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= current && d <= monthEnd;
      });
      points.push({
        label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: monthOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0),
        orders: monthOrders.length,
        seats: monthOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0),
      });
      current.setMonth(current.getMonth() + 1);
    }
  }

  return points;
}
