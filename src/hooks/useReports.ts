import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DateRange {
  from: string;
  to: string;
}

export interface SalesReport {
  totalOrders: number;
  totalRevenue: number;
  totalSeats: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByEvent: Array<{
    eventId: string;
    eventTitle: string;
    count: number;
    revenue: number;
  }>;
  timeline: Array<{
    date: string;
    label: string;
    orders: number;
    revenue: number;
    seats: number;
  }>;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  customerRetention: number;
  topCustomers: Array<{
    email: string;
    name: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
  }>;
  customersByMonth: Array<{
    month: string;
    label: string;
    newCustomers: number;
    returningCustomers: number;
  }>;
  averageOrdersPerCustomer: number;
  averageLifetimeValue: number;
}

export interface ProductPerformance {
  topProducts: Array<{
    productId: string;
    productName: string;
    categoryName: string;
    unitsSold: number;
    revenue: number;
    avgPrice: number;
  }>;
  lowStockProducts: Array<{
    productId: string;
    productName: string;
    stock: number;
    categoryName: string;
  }>;
  outOfStockProducts: Array<{
    productId: string;
    productName: string;
    categoryName: string;
  }>;
  totalProductsActive: number;
  totalProductsInactive: number;
  categoryBreakdown: Array<{
    categoryName: string;
    productCount: number;
    revenue: number;
    unitsSold: number;
  }>;
}

export interface RevenueReport {
  totalEventRevenue: number;
  totalProductRevenue: number;
  totalGiftCardRevenue: number;
  combinedRevenue: number;
  revenueByMonth: Array<{
    month: string;
    label: string;
    eventRevenue: number;
    productRevenue: number;
    giftCardRevenue: number;
  }>;
  revenueByVenue: Array<{
    venueId: string;
    venueName: string;
    revenue: number;
    orders: number;
  }>;
}

type SalesReportOrder = {
  id: string;
  total_amount: number | null;
  total_seats: number | null;
  status: string;
  created_at: string;
  event?: {
    id?: string | null;
    title?: string | null;
  } | null;
};

type CustomerReportOrder = {
  id: string;
  purchaser_email: string | null;
  purchaser_name: string | null;
  total_amount: number | null;
  status: string;
  created_at: string;
};

type ProductReportOrder = {
  id: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  status: string;
  created_at: string;
  product?: {
    id?: string | null;
    name?: string | null;
    stock?: number | null;
    category?: {
      name?: string | null;
    } | null;
  } | null;
};

type ProductReportProduct = {
  id: string;
  name: string;
  stock: number | null;
  is_active: boolean;
  category?: {
    name?: string | null;
  } | null;
};

type EventRevenueOrder = {
  id: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  event?: {
    venue?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
};

type ProductRevenueOrder = {
  id: string;
  total_price: number | null;
  status: string;
  created_at: string;
};

type GiftCardRevenueRow = {
  id: string;
  amount: number | null;
  created_at: string;
};

function buildTimeline(dates: string[], period: 'daily' | 'weekly' | 'monthly'): { date: string; label: string }[] {
  if (dates.length === 0) return [];
  
  const sorted = [...new Set(dates)].sort();
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const points: { date: string; label: string }[] = [];
  
  if (period === 'daily') {
    const current = new Date(fromDate);
    while (current <= toDate) {
      points.push({
        date: current.toISOString().slice(0, 10),
        label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
      current.setDate(current.getDate() + 1);
    }
  } else if (period === 'weekly') {
    const current = new Date(fromDate);
    current.setDate(current.getDate() - current.getDay());
    while (current <= toDate) {
      points.push({
        date: current.toISOString().slice(0, 10),
        label: `Week of ${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      });
      current.setDate(current.getDate() + 7);
    }
  } else {
    const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    while (current <= toDate) {
      points.push({
        date: current.toISOString().slice(0, 10),
        label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      });
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return points;
}

export function useSalesReport(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['salesReport', dateRange],
    queryFn: async (): Promise<SalesReport> => {
      const now = new Date();
      const from = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = dateRange?.to || now.toISOString();

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          total_seats,
          status,
          created_at,
          event:events(id, title)
        `)
        .in('status', ['paid', 'pending'])
        .gte('created_at', from)
        .lte('created_at', to);

      if (error) throw error;
      const allOrders = (orders || []) as SalesReportOrder[];

      const totalOrders = allOrders.length;
      const totalRevenue = allOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const totalSeats = allOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const ordersByStatus: Record<string, number> = {};
      allOrders.forEach((o) => {
        ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
      });

      const eventMap = new Map<string, { title: string; count: number; revenue: number }>();
      allOrders.forEach((o) => {
        const eventId = o.event?.id || 'unknown';
        const eventTitle = o.event?.title || 'Unknown Event';
        const existing = eventMap.get(eventId) || { title: eventTitle, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += Number(o.total_amount || 0);
        eventMap.set(eventId, existing);
      });
      const ordersByEvent = Array.from(eventMap.entries()).map(([eventId, v]) => ({
        eventId,
        eventTitle: v.title,
        count: v.count,
        revenue: v.revenue,
      }));

      const dates = allOrders.map((o) => o.created_at?.slice(0, 10) || '');
      const timelinePoints = buildTimeline(dates, 'daily');
      const timeline = timelinePoints.map(point => {
        const dayOrders = allOrders.filter((o) => o.created_at?.slice(0, 10) === point.date);
        return {
          date: point.date,
          label: point.label,
          orders: dayOrders.length,
          revenue: dayOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0),
          seats: dayOrders.reduce((acc, o) => acc + (o.total_seats || 0), 0),
        };
      });

      return {
        totalOrders,
        totalRevenue,
        totalSeats,
        avgOrderValue,
        ordersByStatus,
        ordersByEvent,
        timeline,
      };
    },
  });
}

export function useCustomerAnalytics(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['customerAnalytics', dateRange],
    queryFn: async (): Promise<CustomerAnalytics> => {
      const now = new Date();
      const from = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = dateRange?.to || now.toISOString();

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, purchaser_email, purchaser_name, total_amount, status, created_at')
        .in('status', ['paid', 'pending'])
        .gte('created_at', from)
        .lte('created_at', to);

      if (error) throw error;
      const allOrders = (orders || []) as CustomerReportOrder[];

      const { data: previousOrders } = await supabase
        .from('orders')
        .select('id, purchaser_email, purchaser_name, total_amount, status, created_at')
        .in('status', ['paid', 'pending'])
        .lt('created_at', from);

      const prevCustomerEmails = new Set(((previousOrders || []) as CustomerReportOrder[]).map((o) => o.purchaser_email?.toLowerCase()).filter(Boolean));
      
      const customerMap = new Map<string, { name: string; orders: number; spent: number; lastDate: string }>();
      allOrders.forEach((o) => {
        const email = o.purchaser_email?.toLowerCase();
        if (!email) return;
        const existing = customerMap.get(email) || { name: o.purchaser_name || 'Unknown Customer', orders: 0, spent: 0, lastDate: '' };
        existing.orders += 1;
        existing.spent += Number(o.total_amount || 0);
        if (!existing.lastDate || o.created_at > existing.lastDate) {
          existing.lastDate = o.created_at;
        }
        customerMap.set(email, existing);
      });

      let newCustomers = 0;
      let returningCustomers = 0;
      customerMap.forEach((_, email) => {
        if (prevCustomerEmails.has(email)) {
          returningCustomers++;
        } else {
          newCustomers++;
        }
      });

      const totalCustomers = customerMap.size;
      const customerRetention = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

      const topCustomers = Array.from(customerMap.entries())
        .map(([email, v]) => ({
          email,
          name: v.name,
          totalOrders: v.orders,
          totalSpent: v.spent,
          lastOrderDate: v.lastDate,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      const { data: allHistoricalOrders } = await supabase
        .from('orders')
        .select('id, purchaser_email, purchaser_name, total_amount, status, created_at')
        .in('status', ['paid', 'pending']);

      const allCustomerMap = new Map<string, { orders: number; spent: number }>();
      ((allHistoricalOrders || []) as CustomerReportOrder[]).forEach((o) => {
        const email = o.purchaser_email?.toLowerCase();
        if (!email) return;
        const existing = allCustomerMap.get(email) || { orders: 0, spent: 0 };
        existing.orders += 1;
        existing.spent += Number(o.total_amount || 0);
        allCustomerMap.set(email, existing);
      });

      const avgOrdersPerCustomer = allCustomerMap.size > 0
        ? Array.from(allCustomerMap.values()).reduce((acc, c) => acc + c.orders, 0) / allCustomerMap.size
        : 0;
      const avgLifetimeValue = allCustomerMap.size > 0
        ? Array.from(allCustomerMap.values()).reduce((acc, c) => acc + c.spent, 0) / allCustomerMap.size
        : 0;

      const dates = allOrders.map((o) => o.created_at?.slice(0, 10) || '');
      const timelinePoints = buildTimeline(dates, 'weekly');
      const customersByMonth = timelinePoints.map(point => {
        const monthOrders = allOrders.filter((o) => {
          const orderMonth = new Date(o.created_at).toISOString().slice(0, 10);
          return orderMonth.startsWith(point.date.slice(0, 7));
        });
        const monthEmails = new Set(monthOrders.map((o) => o.purchaser_email?.toLowerCase()).filter(Boolean));
        const newInMonth = Array.from(monthEmails).filter(email => !prevCustomerEmails.has(email)).length;
        const returningInMonth = Array.from(monthEmails).filter(email => prevCustomerEmails.has(email)).length;
        return {
          month: point.date.slice(0, 7),
          label: point.label,
          newCustomers: newInMonth,
          returningCustomers: returningInMonth,
        };
      });

      return {
        totalCustomers,
        newCustomers,
        returningCustomers,
        customerRetention,
        topCustomers,
        customersByMonth,
        averageOrdersPerCustomer: avgOrdersPerCustomer,
        averageLifetimeValue: avgLifetimeValue,
      };
    },
  });
}

export function useProductPerformance(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['productPerformance', dateRange],
    queryFn: async (): Promise<ProductPerformance> => {
      const now = new Date();
      const from = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = dateRange?.to || now.toISOString();

      const { data: productOrders, error } = await supabase
        .from('product_orders')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          status,
          created_at,
          product:products(id, name, stock, category:product_categories(name))
        `)
        .in('status', ['paid', 'pending', 'shipped', 'delivered'])
        .gte('created_at', from)
        .lte('created_at', to);

      if (error) throw error;
      const allProductOrders = (productOrders || []) as ProductReportOrder[];

      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock, is_active, category:product_categories(name)');

      const productMap = new Map<string, { name: string; category: string; units: number; revenue: number }>();
      allProductOrders.forEach((o) => {
        const productId = o.product?.id || 'unknown';
        const productName = o.product?.name || 'Unknown Product';
        const categoryName = o.product?.category?.name || 'Uncategorized';
        const existing = productMap.get(productId) || { name: productName, category: categoryName, units: 0, revenue: 0 };
        existing.units += o.quantity || 0;
        existing.revenue += Number(o.total_price || 0);
        productMap.set(productId, existing);
      });

      const topProducts = Array.from(productMap.entries())
        .map(([productId, v]) => ({
          productId,
          productName: v.name,
          categoryName: v.category,
          unitsSold: v.units,
          revenue: v.revenue,
          avgPrice: v.units > 0 ? v.revenue / v.units : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const allProducts = (products || []) as ProductReportProduct[];
      const lowStockProducts = allProducts
        .filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 10)
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          stock: p.stock || 0,
          categoryName: p.category?.name || 'Uncategorized',
        }));

      const outOfStockProducts = allProducts
        .filter((p) => p.stock === 0)
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          categoryName: p.category?.name || 'Uncategorized',
        }));

      const totalProductsActive = allProducts.filter((p) => p.is_active).length;
      const totalProductsInactive = allProducts.filter((p) => !p.is_active).length;

      const categoryMap = new Map<string, { count: number; revenue: number; units: number }>();
      productMap.forEach((v) => {
        const existing = categoryMap.get(v.category) || { count: 0, revenue: 0, units: 0 };
        existing.count += 1;
        existing.revenue += v.revenue;
        existing.units += v.units;
        categoryMap.set(v.category, existing);
      });
      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([categoryName, v]) => ({
          categoryName,
          productCount: v.count,
          revenue: v.revenue,
          unitsSold: v.units,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        topProducts,
        lowStockProducts,
        outOfStockProducts,
        totalProductsActive,
        totalProductsInactive,
        categoryBreakdown,
      };
    },
  });
}

export function useRevenueReport(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['revenueReport', dateRange],
    queryFn: async (): Promise<RevenueReport> => {
      const now = new Date();
      const from = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = dateRange?.to || now.toISOString();

      const { data: eventOrders } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          event:events(venue:venues(id, name))
        `)
        .eq('status', 'paid')
        .gte('created_at', from)
        .lte('created_at', to);

      const { data: productOrders } = await supabase
        .from('product_orders')
        .select('id, total_price, status, created_at')
        .in('status', ['paid', 'pending', 'shipped', 'delivered'])
        .gte('created_at', from)
        .lte('created_at', to);

      const { data: giftCards } = await supabase
        .from('gift_cards')
        .select('id, amount, created_at')
        .gte('created_at', from)
        .lte('created_at', to);

      const allEventOrders = (eventOrders || []) as EventRevenueOrder[];
      const allProductRevenueOrders = (productOrders || []) as ProductRevenueOrder[];
      const allGiftCards = (giftCards || []) as GiftCardRevenueRow[];

      const totalEventRevenue = allEventOrders
        .reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const totalProductRevenue = allProductRevenueOrders
        .reduce((acc, o) => acc + Number(o.total_price || 0), 0);
      const totalGiftCardRevenue = allGiftCards
        .reduce((acc, o) => acc + Number(o.amount || 0), 0);
      const combinedRevenue = totalEventRevenue + totalProductRevenue + totalGiftCardRevenue;

      const revenueByMonth: RevenueReport['revenueByMonth'] = [];
      const monthMap = new Map<string, { event: number; product: number; giftCard: number }>();
      
      allEventOrders.forEach((o) => {
        const month = o.created_at?.slice(0, 7) || '';
        const existing = monthMap.get(month) || { event: 0, product: 0, giftCard: 0 };
        existing.event += Number(o.total_amount || 0);
        monthMap.set(month, existing);
      });

      allProductRevenueOrders.forEach((o) => {
        const month = o.created_at?.slice(0, 7) || '';
        const existing = monthMap.get(month) || { event: 0, product: 0, giftCard: 0 };
        existing.product += Number(o.total_price || 0);
        monthMap.set(month, existing);
      });

      allGiftCards.forEach((o) => {
        const month = o.created_at?.slice(0, 7) || '';
        const existing = monthMap.get(month) || { event: 0, product: 0, giftCard: 0 };
        existing.giftCard += Number(o.amount || 0);
        monthMap.set(month, existing);
      });

      Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([month, v]) => {
          const date = new Date(month + '-01');
          revenueByMonth.push({
            month,
            label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            eventRevenue: v.event,
            productRevenue: v.product,
            giftCardRevenue: v.giftCard,
          });
        });

      const venueMap = new Map<string, { name: string; revenue: number; orders: number }>();
      allEventOrders.forEach((o) => {
        const venueId = o.event?.venue?.id || 'unknown';
        const venueName = o.event?.venue?.name || 'Unknown Venue';
        const existing = venueMap.get(venueId) || { name: venueName, revenue: 0, orders: 0 };
        existing.revenue += Number(o.total_amount || 0);
        existing.orders += 1;
        venueMap.set(venueId, existing);
      });
      const revenueByVenue = Array.from(venueMap.entries())
        .map(([venueId, v]) => ({
          venueId,
          venueName: v.name,
          revenue: v.revenue,
          orders: v.orders,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        totalEventRevenue,
        totalProductRevenue,
        totalGiftCardRevenue,
        combinedRevenue,
        revenueByMonth,
        revenueByVenue,
      };
    },
  });
}
