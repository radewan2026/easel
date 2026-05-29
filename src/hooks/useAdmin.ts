import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Account } from '../types/database';

type DashboardOrder = {
  id: string;
  event_id: string | null;
  purchaser_email: string | null;
  total_amount: number | null;
  total_seats: number | null;
  coupon_id?: string | null;
  created_at: string;
};

type DashboardEvent = {
  id: string;
  title: string;
  venue_id?: string | null;
  max_seats: number | null;
  seats_available: number | null;
  start_datetime?: string;
};

type DashboardVenue = {
  id: string;
  name: string;
};

type DashboardProduct = {
  id: string;
  name: string;
  stock: number | null;
  is_active: boolean;
};

export const DASHBOARD_WIDGETS = [
  { id: 'revenue', title: 'Revenue', priority: 1, span: 3 },
  { id: 'seats-sold', title: 'Seats Sold', priority: 1, span: 3 },
  { id: 'avg-ticket', title: 'Avg Ticket Value', priority: 1, span: 3 },
  { id: 'repeat-rate', title: 'Repeat Customer Rate', priority: 1, span: 3 },
  { id: 'sales-chart', title: 'Sales Chart', priority: 1, span: 8 },
  { id: 'recent-sales', title: 'Recent Sales', priority: 1, span: 4 },
  { id: 'upcoming-events', title: 'Upcoming Events', priority: 1, span: 6 },
  { id: 'low-inventory', title: 'Low Inventory Alerts', priority: 2, span: 3 },
  { id: 'gift-card', title: 'Gift Card Liability', priority: 2, span: 3 },
  { id: 'coupon-usage', title: 'Coupon Usage Rate', priority: 2, span: 3 },
  { id: 'active-coupons', title: 'Active Coupons', priority: 2, span: 3 },
  { id: 'churn-risk', title: 'Churn Risk', priority: 2, span: 3 },
  { id: 'email-subscribers', title: 'New Subscribers', priority: 2, span: 3 },
  { id: 'analytics-summary', title: 'Traffic Snapshot', priority: 2, span: 4 },
  { id: 'email-campaigns', title: 'Email Campaigns', priority: 2, span: 4 },
  { id: 'action-items', title: 'Action Items', priority: 3, span: 4 },
  { id: 'quick-actions', title: 'Quick Actions', priority: 3, span: 4 },
  { id: 'top-events', title: 'Top Events by Revenue', priority: 3, span: 4 },
  { id: 'venue-util', title: 'Venue Utilization', priority: 3, span: 4 },
] as const;

export type WidgetId = typeof DASHBOARD_WIDGETS[number]['id'];

export type DateRange = '7d' | '30d' | '90d' | 'custom';

export interface DashboardPreferences {
  userId: string;
  widgets: WidgetId[];
  dateRange: DateRange;
  customDateFrom?: string;
  customDateTo?: string;
}

const DEFAULT_WIDGETS: WidgetId[] = ['revenue', 'seats-sold', 'avg-ticket', 'repeat-rate', 'sales-chart', 'recent-sales', 'upcoming-events', 'low-inventory', 'gift-card'];
const DEFAULT_DATE_RANGE: DateRange = '30d';

function getDateRangeConfig(dateRange: DateRange, customDateFrom?: string, customDateTo?: string): { from: Date; to: Date; priorFrom: Date; priorTo: Date } {
  const now = new Date();
  let to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let days = 30;
  if (dateRange === '7d') days = 7;
  else if (dateRange === '90d') days = 90;

  let from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  if (dateRange === 'custom' && customDateFrom && customDateTo) {
    from = new Date(`${customDateFrom}T00:00:00`);
    to = new Date(`${customDateTo}T23:59:59`);
    days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
  }

  const priorTo = new Date(from.getTime() - 1000);
  const priorFrom = new Date(priorTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, priorFrom, priorTo };
}

export function useDashboardStats(dateRange: DateRange = '30d', customDateFrom?: string, customDateTo?: string) {
  const config = getDateRangeConfig(dateRange, customDateFrom, customDateTo);
  
  return useQuery({
    queryKey: ['dashboardStats', dateRange, customDateFrom, customDateTo],
    queryFn: async () => {
      const { from, to, priorFrom, priorTo } = config;

      const [
        upcomingEventsRes,
        couponsRes,
        giftCardsRes,
        subscribersRes,
        ordersRes,
        priorOrdersRes,
        eventsRes,
        venuesRes,
        productsRes,
      ] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, start_datetime, max_seats, seats_available, venue:venues(name)')
          .gte('start_datetime', new Date().toISOString())
          .eq('is_published', true)
          .order('start_datetime', { ascending: true })
          .limit(5),
        supabase.from('coupons').select('id, code, is_active').eq('is_active', true),
        supabase.from('gift_cards').select('id, amount, is_redeemed'),
        supabase.from('newsletter_subscribers').select('id, is_active'),
        supabase
          .from('orders')
          .select('*, event:events(id, title, start_datetime, max_seats, venue:venues(name))')
          .gte('created_at', from.toISOString())
          .lt('created_at', to.toISOString())
          .eq('status', 'paid'),
        supabase
          .from('orders')
          .select('purchaser_email, total_amount, total_seats, created_at')
          .gte('created_at', priorFrom.toISOString())
          .lt('created_at', priorTo.toISOString())
          .eq('status', 'paid'),
        supabase
          .from('events')
          .select('id, title, start_datetime, max_seats, seats_available')
          .gte('start_datetime', from.toISOString())
          .lt('start_datetime', to.toISOString())
          .eq('is_published', true),
        supabase.from('venues').select('id, name'),
        supabase.from('products').select('id, name, stock, is_active'),
      ]);

      const orders = (ordersRes.data || []) as DashboardOrder[];
      const priorOrders = (priorOrdersRes.data || []) as DashboardOrder[];
      const coupons = couponsRes.data || [];
      const giftCards = giftCardsRes.data || [];
      const subscribers = subscribersRes.data || [];
      const upcomingEvents = (upcomingEventsRes.data || []) as DashboardEvent[];
      const events = (eventsRes.data || []) as DashboardEvent[];
      const venues = (venuesRes.data || []) as DashboardVenue[];
      const products = (productsRes.data || []) as DashboardProduct[];

      const totalRevenue = orders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const priorRevenue = priorOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const revenueChange = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0;

      const totalSeats = orders.reduce((acc, o) => acc + (o.total_seats || 0), 0);
      const priorSeats = priorOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0);
      const seatsChange = priorSeats > 0 ? ((totalSeats - priorSeats) / priorSeats) * 100 : 0;

      const totalOrders = orders.length;
      const avgTicketValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const priorAvgTicket = priorOrders.length > 0 ? priorRevenue / priorOrders.length : 0;
      const avgTicketChange = priorAvgTicket > 0 ? ((avgTicketValue - priorAvgTicket) / priorAvgTicket) * 100 : 0;

      const customerEmails = new Set(orders.map(o => o.purchaser_email?.toLowerCase()).filter(Boolean));
      
      let repeatCustomers = 0;
      let newCustomers = 0;

      const { data: allHistoricalOrders, error: histError } = await supabase
        .from('orders')
        .select('purchaser_email')
        .eq('status', 'paid')
        .lt('created_at', from.toISOString());
      
      if (histError) {
        console.error('Failed to fetch historical orders for repeat rate:', histError);
      }

      const existingEmails = new Set((allHistoricalOrders || []).map(o => o.purchaser_email?.toLowerCase()).filter(Boolean));
      
      customerEmails.forEach(email => {
        if (existingEmails.has(email)) repeatCustomers++;
        else newCustomers++;
      });
      const repeatRate = customerEmails.size > 0 ? (repeatCustomers / customerEmails.size) * 100 : 0;

      const couponOrders = orders.filter(o => o.coupon_id);
      const couponUsageRate = totalOrders > 0 ? (couponOrders.length / totalOrders) * 100 : 0;

      const activeCouponsCount = coupons.length;

      const unredeemedGiftCards = giftCards.filter(g => !g.is_redeemed);
      const giftCardLiability = unredeemedGiftCards.reduce((acc, g) => acc + Number(g.amount || 0), 0);

      const newSubscribers = subscribers.filter(s => s.is_active).length;

      const lowInventoryEvents = upcomingEvents.filter((e) => {
        const max = e.max_seats || 0;
        const available = e.seats_available ?? max;
        const sold = max - available;
        return max > 0 && (sold / max) >= 0.8;
      });

      const recentOrders = [...orders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      const salesByWeek: { week: string; label: string; revenue: number; seats: number; orders: number }[] = [];
      const weeks = dateRange === '7d' ? 1 : dateRange === '90d' ? 12 : Math.max(1, Math.min(12, Math.ceil((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000))));
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = new Date(from.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const weekOrders = orders.filter((o) => {
          const d = new Date(o.created_at);
          return d >= weekStart && d < weekEnd;
        });
        const shortLabel = fmt(weekStart);
        salesByWeek.push({
          week: `${fmt(weekStart)} – ${fmt(new Date(weekEnd.getTime() - 1))}`,
          label: shortLabel,
          revenue: weekOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0),
          seats: weekOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0),
          orders: weekOrders.length,
        });
      }

      const topEventsByRevenue = events
        .map((e) => {
          const eventOrders = orders.filter((o) => o.event_id === e.id);
          return {
            id: e.id,
            title: e.title,
            revenue: eventOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0),
            orders: eventOrders.length,
            seats: eventOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0),
          };
        })
        .filter((e) => e.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const venueUtilization = venues.map((v) => {
        const venueEvents = events.filter((e) => e.venue_id === v.id);
        const totalSeats = venueEvents.reduce((acc, e) => acc + (e.max_seats || 0), 0);
        const soldSeats = orders
          .filter((o) => venueEvents.some((e) => e.id === o.event_id))
          .reduce((acc, o) => acc + (o.total_seats || 0), 0);
        return {
          name: v.name,
          fillRate: totalSeats > 0 ? (soldSeats / totalSeats) * 100 : 0,
        };
      });

      const upcomingEventsWithFillRate = upcomingEvents.map((e) => ({
        ...e,
        fillRate: e.max_seats ? Math.round(((e.max_seats - (e.seats_available || e.max_seats)) / e.max_seats) * 100) : 0,
      }));

      const churnRiskCount = 0;

      const actionItems: { id: string; message: string; type: 'warning' | 'info' | 'success' }[] = [];
      upcomingEvents.slice(0, 3).forEach((e) => {
        if (e.seats_available && e.max_seats) {
          const fillPct = ((e.max_seats - e.seats_available) / e.max_seats) * 100;
          if (fillPct >= 80) {
            actionItems.push({ id: `sellout-${e.id}`, message: `"${e.title}" is ${fillPct.toFixed(0)}% sold out`, type: 'warning' });
          }
        }
      });
      const outOfStockCount = products.filter((p) => p.stock === 0 && p.is_active).length;
      if (outOfStockCount > 0) {
        actionItems.push({ id: 'stock', message: `${outOfStockCount} product(s) out of stock`, type: 'warning' });
      }

      return {
        revenue: { value: totalRevenue, change: revenueChange },
        seatsSold: { value: totalSeats, change: seatsChange },
        avgTicketValue,
        avgTicketChange,
        repeatRate,
        repeatCustomers,
        newCustomers,
        totalCustomers: customerEmails.size,
        couponUsageRate,
        activeCouponsCount,
        giftCardLiability,
        newSubscribers,
        totalSubscribers: subscribers.length,
        lowInventoryEvents,
        upcomingEvents: upcomingEventsWithFillRate,
        recentOrders,
        salesByWeek,
        topEventsByRevenue,
        venueUtilization,
        churnRiskCount,
        actionItems,
        products: products.filter((p) => p.is_active),
        outOfStockCount,
        lowStockCount: products.filter((p) => p.is_active && (p.stock || 0) > 0 && (p.stock || 0) <= 10).length,
      };
    },
  });
}

export function useDashboardPreferences(userId?: string) {
  return useQuery({
    queryKey: ['dashboardPreferences', userId],
    queryFn: async () => {
      const defaultPrefs: DashboardPreferences = {
        userId: userId || '',
        widgets: DEFAULT_WIDGETS,
        dateRange: DEFAULT_DATE_RANGE,
      };

      if (!userId) return defaultPrefs;
      
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `dashboard_prefs_${userId}`)
        .single();
      
      if (error || !data) return defaultPrefs;
      
      try {
        return JSON.parse(data.value as string) as DashboardPreferences;
      } catch {
        return defaultPrefs;
      }
    },
    enabled: !!userId,
  });
}

export function useUpdateDashboardPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: DashboardPreferences) => {
      const key = `dashboard_prefs_${prefs.userId}`;
      const { data, error } = await supabase
        .from('settings')
        .upsert({ key, value: JSON.stringify({ ...prefs }) }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, prefs) => {
      queryClient.invalidateQueries({ queryKey: ['dashboardPreferences', prefs.userId] });
    },
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Partial<Account>) => {
      const { data, error } = await supabase.from('accounts').insert(account).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...account }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(account)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { data, error } = await supabase
        .from('settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useSiteSetting(key: string, fallback: string = '') {
  const { data } = useSettings();
  const parsed = data?.find((s) => s.key === 'siteSettings')?.value as Record<string, string> | undefined;
  return parsed?.[key] ?? fallback;
}
