import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Tenant, Plan, TenantFeatures } from '../types/database';

type TenantWithPlan = Tenant & { plan: Plan | null };

export function useTenantPlan() {
  return useQuery({
    queryKey: ['tenant-plan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*, plan:plan_id(*)')
        .single();

      if (error) throw error;
      return data as TenantWithPlan;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    meta: { errorMessage: 'Failed to load subscription plan' },
  });
}

const EMPTY_FEATURES: TenantFeatures = {
  analytics: false,
  email_marketing: false,
  gift_cards: false,
  referrals: false,
  corporate_accounts: false,
  api_access: false,
  automations: false,
  unlimited_staff: false,
  max_staff: 5,
  support_level: 'standard',
};

export function useFeatures(): {
  features: TenantFeatures;
  planName: string;
  isLoading: boolean;
  hasFeature: (feature: keyof TenantFeatures) => boolean;
} {
  const { data: tenant, isLoading } = useTenantPlan();

  const features = tenant?.plan?.features ?? EMPTY_FEATURES;
  const planName = tenant?.plan?.name ?? 'Starter';

  const hasFeature = (feature: keyof TenantFeatures): boolean => {
    return features[feature] === true;
  };

  return { features, planName, isLoading, hasFeature };
}
