import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const MEMBERSHIP_STORAGE_KEY = 'paint_sip_membership_redemptions';

export interface MembershipPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  creditsPerCycle: number;
  renewalDate: string;
  status: 'active' | 'paused' | 'past_due' | 'canceled';
}

export interface MembershipRedemption {
  id: string;
  customerEmail: string;
  eventId: string;
  orderId: string;
  creditsUsed: number;
  amountCovered: number;
  redeemedAt: string;
}

type MembershipLedger = {
  plan: MembershipPlan | null;
  redemptions: MembershipRedemption[];
  source: 'backend' | 'demo';
};

type RedeemInput = Omit<MembershipRedemption, 'id' | 'customerEmail' | 'redeemedAt'>;

type BackendError = {
  code?: string;
  message?: string;
  details?: string;
};

type MembershipPlanRow = {
  id?: string;
  plan_id?: string;
  plan_name?: string;
  name?: string;
  monthly_price?: number | string | null;
  monthlyPrice?: number | string | null;
  credits_per_cycle?: number | string | null;
  creditsPerCycle?: number | string | null;
  renewal_date?: string | null;
  renewalDate?: string | null;
  status?: MembershipPlan['status'];
};

type MembershipRedemptionRow = {
  id?: string;
  customer_email?: string;
  customerEmail?: string;
  event_id?: string;
  eventId?: string;
  order_id?: string;
  orderId?: string;
  credits_used?: number | string | null;
  creditsUsed?: number | string | null;
  amount_covered?: number | string | null;
  amountCovered?: number | string | null;
  redeemed_at?: string | null;
  redeemedAt?: string | null;
  created_at?: string | null;
};

const CUSTOMER_MEMBERSHIPS_TABLE = 'customer_memberships' as never;
const MEMBERSHIP_REDEMPTIONS_TABLE = 'membership_credit_redemptions' as never;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readDemoRedemptions(): MembershipRedemption[] {
  try {
    const stored = localStorage.getItem(MEMBERSHIP_STORAGE_KEY);
    return stored ? JSON.parse(stored) as MembershipRedemption[] : [];
  } catch {
    return [];
  }
}

function writeDemoRedemptions(redemptions: MembershipRedemption[]) {
  localStorage.setItem(MEMBERSHIP_STORAGE_KEY, JSON.stringify(redemptions));
}

function getNextRenewalDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function getDemoPlan(): MembershipPlan {
  return {
    id: 'demo-creative-duo',
    name: 'Creative Duo',
    monthlyPrice: 49,
    creditsPerCycle: 2,
    renewalDate: getNextRenewalDate(),
    status: 'active',
  };
}

function mapPlan(row: MembershipPlanRow | null): MembershipPlan | null {
  if (!row) return null;
  return {
    id: row.id || row.plan_id || 'membership',
    name: row.plan_name || row.name || 'Membership',
    monthlyPrice: Number(row.monthly_price ?? row.monthlyPrice ?? 0),
    creditsPerCycle: Number(row.credits_per_cycle ?? row.creditsPerCycle ?? 0),
    renewalDate: row.renewal_date || row.renewalDate || getNextRenewalDate(),
    status: row.status || 'active',
  };
}

function mapRedemption(row: MembershipRedemptionRow): MembershipRedemption {
  return {
    id: row.id || 'redemption',
    customerEmail: normalizeEmail(row.customer_email || row.customerEmail || ''),
    eventId: row.event_id || row.eventId || '',
    orderId: row.order_id || row.orderId || '',
    creditsUsed: Number(row.credits_used ?? row.creditsUsed ?? 0),
    amountCovered: Number(row.amount_covered ?? row.amountCovered ?? 0),
    redeemedAt: row.redeemed_at || row.redeemedAt || row.created_at || new Date().toISOString(),
  };
}

function isMissingMembershipTable(error: unknown) {
  const backendError = error as BackendError | null;
  const message = `${backendError?.message || ''} ${backendError?.details || ''}`.toLowerCase();
  return backendError?.code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function getDemoLedger(normalizedEmail: string): MembershipLedger {
  const redemptions = readDemoRedemptions().filter((redemption) => redemption.customerEmail === normalizedEmail);
  return {
    plan: normalizedEmail ? getDemoPlan() : null,
    redemptions,
    source: 'demo',
  };
}

function shouldQueryMembershipBackend() {
  return import.meta.env.VITE_MEMBERSHIP_BACKEND_ENABLED === 'true';
}

export function useMembershipCredits(email?: string | null) {
  const normalizedEmail = useMemo(() => email ? normalizeEmail(email) : '', [email]);
  const queryClient = useQueryClient();

  const ledgerQuery = useQuery({
    queryKey: ['membershipLedger', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async (): Promise<MembershipLedger> => {
      if (!shouldQueryMembershipBackend()) {
        return getDemoLedger(normalizedEmail);
      }

      const [membershipResult, redemptionResult] = await Promise.all([
        supabase
          .from(CUSTOMER_MEMBERSHIPS_TABLE)
          .select('*')
          .ilike('customer_email', normalizedEmail)
          .maybeSingle(),
        supabase
          .from(MEMBERSHIP_REDEMPTIONS_TABLE)
          .select('*')
          .ilike('customer_email', normalizedEmail)
          .order('redeemed_at', { ascending: false }),
      ]);

      if (isMissingMembershipTable(membershipResult.error) || isMissingMembershipTable(redemptionResult.error)) {
        return getDemoLedger(normalizedEmail);
      }

      if (membershipResult.error) throw membershipResult.error;
      if (redemptionResult.error) throw redemptionResult.error;

      return {
        plan: mapPlan(membershipResult.data as MembershipPlanRow | null),
        redemptions: ((redemptionResult.data || []) as MembershipRedemptionRow[]).map(mapRedemption),
        source: 'backend',
      };
    },
  });

  const ledger = ledgerQuery.data || getDemoLedger(normalizedEmail);
  const usedCredits = ledger.redemptions.reduce((sum, redemption) => sum + redemption.creditsUsed, 0);
  const availableCredits = Math.max((ledger.plan?.creditsPerCycle || 0) - usedCredits, 0);

  const redeemMutation = useMutation({
    mutationFn: async (redemption: RedeemInput): Promise<MembershipRedemption | null> => {
      if (!normalizedEmail || redemption.creditsUsed <= 0) return null;
      if (redemption.creditsUsed > availableCredits) {
        throw new Error('Not enough membership credits are available for this booking.');
      }

      if (ledger.source === 'backend' && shouldQueryMembershipBackend()) {
        const { data, error } = await supabase
          .from(MEMBERSHIP_REDEMPTIONS_TABLE)
          .insert({
            customer_email: normalizedEmail,
            event_id: redemption.eventId,
            order_id: redemption.orderId,
            credits_used: redemption.creditsUsed,
            amount_covered: redemption.amountCovered,
            redeemed_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (isMissingMembershipTable(error)) {
          // Local/demo databases can run before the production ledger tables exist.
        } else if (error) {
          throw error;
        } else {
          return mapRedemption(data as MembershipRedemptionRow);
        }
      }

      const nextRedemption: MembershipRedemption = {
        ...redemption,
        id: `credit_${Date.now()}`,
        customerEmail: normalizedEmail,
        redeemedAt: new Date().toISOString(),
      };
      const allRedemptions = readDemoRedemptions();
      writeDemoRedemptions([nextRedemption, ...allRedemptions]);
      return nextRedemption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipLedger', normalizedEmail] });
    },
  });

  return {
    plan: ledger.plan,
    redemptions: ledger.redemptions,
    usedCredits,
    availableCredits,
    source: ledger.source,
    isLoading: ledgerQuery.isLoading,
    isRedeeming: redeemMutation.isPending,
    redeemCredits: redeemMutation.mutateAsync,
  };
}
