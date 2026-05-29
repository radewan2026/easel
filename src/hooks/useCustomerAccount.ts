import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { GiftCard, Order, PrivateEventRequest, ProductOrder, WaitlistEntry } from '../types/database';

export interface CustomerAccountData {
  orders: Order[];
  upcomingOrders: Order[];
  pastOrders: Order[];
  giftCards: GiftCard[];
  productOrders: ProductOrder[];
  waitlistEntries: WaitlistEntry[];
  privateRequests: PrivateEventRequest[];
  totals: {
    lifetimeSpend: number;
    upcomingSeats: number;
    availableGiftCardValue: number;
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function byNewestCreated<T extends { created_at: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function useCustomerAccount(email?: string | null) {
  const normalizedEmail = useMemo(() => (email ? normalizeEmail(email) : ''), [email]);

  return useQuery({
    queryKey: ['customerAccount', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async (): Promise<CustomerAccountData> => {
      const [ordersResult, giftCardsResult, productOrdersResult, waitlistResult, privateRequestsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*, event:events(*), coupon:coupons(*), attendees:attendees(*)')
          .ilike('purchaser_email', normalizedEmail)
          .order('created_at', { ascending: false }),
        supabase
          .from('gift_cards')
          .select('*')
          .or(`purchaser_email.ilike.${normalizedEmail},recipient_email.ilike.${normalizedEmail}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('product_orders')
          .select('*, product:products(*)')
          .ilike('purchaser_email', normalizedEmail)
          .order('created_at', { ascending: false }),
        supabase
          .from('waitlist')
          .select('*, event:events(*)')
          .ilike('email', normalizedEmail)
          .order('created_at', { ascending: false }),
        supabase
          .from('private_event_requests')
          .select('*, venue:venues(*)')
          .ilike('contact_email', normalizedEmail)
          .order('created_at', { ascending: false }),
      ]);

      const warnQueryError = (label: string, error: unknown) => {
        if (error) console.warn(`Customer account ${label} unavailable`, error);
      };
      warnQueryError('orders', ordersResult.error);
      warnQueryError('gift cards', giftCardsResult.error);
      warnQueryError('product orders', productOrdersResult.error);
      warnQueryError('waitlist', waitlistResult.error);
      warnQueryError('private requests', privateRequestsResult.error);

      const now = new Date();
      const orders = byNewestCreated((ordersResult.data || []) as Order[]);
      const upcomingOrders = orders
        .filter((order) => order.event?.start_datetime && new Date(order.event.start_datetime) >= now)
        .sort((a, b) => new Date(a.event!.start_datetime).getTime() - new Date(b.event!.start_datetime).getTime());
      const pastOrders = orders.filter((order) => !order.event?.start_datetime || new Date(order.event.start_datetime) < now);
      const giftCards = byNewestCreated((giftCardsResult.data || []) as GiftCard[]);
      const productOrders = byNewestCreated((productOrdersResult.data || []) as ProductOrder[]);
      const waitlistEntries = byNewestCreated((waitlistResult.data || []) as WaitlistEntry[]);
      const privateRequests = byNewestCreated((privateRequestsResult.data || []) as PrivateEventRequest[]);

      return {
        orders,
        upcomingOrders,
        pastOrders,
        giftCards,
        productOrders,
        waitlistEntries,
        privateRequests,
        totals: {
          lifetimeSpend: orders
            .filter((order) => order.status === 'paid')
            .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
            + productOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0),
          upcomingSeats: upcomingOrders.reduce((sum, order) => sum + Number(order.total_seats || 0), 0),
          availableGiftCardValue: giftCards
            .filter((card) => !card.is_redeemed)
            .reduce((sum, card) => sum + Number(card.amount || 0), 0),
        },
      };
    },
  });
}
