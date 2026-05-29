import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { GiftCard } from '../types/database';

function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PS';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useGiftCards() {
  return useQuery({
    queryKey: ['giftCards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GiftCard[];
    },
  });
}

export function usePurchaseGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (card: {
      amount: number;
      purchaser_name: string;
      purchaser_email: string;
      recipient_name?: string;
      recipient_email?: string;
      message?: string;
    }) => {
      const giftCard = { ...card, code: generateGiftCardCode(), remaining_balance: card.amount };
      const { data, error } = await supabase
        .from('gift_cards')
        .insert(giftCard)
        .select()
        .single();
      if (error) throw error;
      return data as GiftCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giftCards'] });
    },
  });
}

export function useRedeemGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, amount }: { code: string; amount: number }) => {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('code', code.toUpperCase())
        .gt('remaining_balance', 0)
        .single();
      if (error || !data) throw new Error('Invalid or already redeemed gift card');
      const newBalance = Math.max(0, (data as GiftCard).remaining_balance - amount);
      const updates: Partial<GiftCard> = { remaining_balance: newBalance };
      if (newBalance === 0) {
        updates.is_redeemed = true;
        updates.redeemed_at = new Date().toISOString();
      }
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update(updates)
        .eq('id', data.id);
      if (updateError) throw updateError;
      return data as GiftCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giftCards'] });
    },
  });
}

export function useDeleteGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gift_cards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giftCards'] });
    },
  });
}
