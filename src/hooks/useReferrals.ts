import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Referral } from '../types/database';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  let code = 'REF';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

export function useReferrals() {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Referral[];
    },
  });
}

export function useValidateReferral() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();
      if (error || !data) return null;
      if (data.max_uses && data.uses >= data.max_uses) return null;
      return data as Referral;
    },
  });
}

export function useCreateReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ referrerName, referrerEmail, discountPercent }: { referrerName: string; referrerEmail: string; discountPercent?: number }) => {
      const referral = {
        code: generateReferralCode(),
        referrer_name: referrerName,
        referrer_email: referrerEmail,
        discount_percent: discountPercent || 10,
      };
      const { data, error } = await supabase.from('referrals').insert(referral).select().single();
      if (error) throw error;
      return data as Referral;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
}

export function useIncrementReferralUse() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase
        .from('referrals')
        .select('uses')
        .eq('code', code.toUpperCase())
        .single();
      if (error || !data) return;
      await supabase
        .from('referrals')
        .update({ uses: data.uses + 1 })
        .eq('code', code.toUpperCase());
    },
  });
}

export function useDeleteReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('referrals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
}
