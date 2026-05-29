import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type AdminMembership = {
  id: string;
  customerEmail: string;
  customerName: string | null;
  planName: string;
  monthlyPrice: number;
  creditsPerCycle: number;
  renewalDate: string;
  status: 'active' | 'paused' | 'past_due' | 'canceled';
  stripeSubscriptionId: string | null;
  createdAt: string;
};

export type AdminMembershipRedemption = {
  id: string;
  customerEmail: string;
  eventTitle: string | null;
  orderId: string;
  creditsUsed: number;
  amountCovered: number;
  redeemedAt: string;
};

export type MembershipAdminData = {
  memberships: AdminMembership[];
  redemptions: AdminMembershipRedemption[];
  source: 'backend' | 'demo';
  totals: {
    activeMembers: number;
    monthlyRecurringRevenue: number;
    creditsIssued: number;
    creditsRedeemed: number;
    outstandingCredits: number;
    creditLiability: number;
  };
};

type BackendError = {
  code?: string;
  message?: string;
  details?: string;
};

type MembershipRow = {
  id?: string;
  customer_email?: string;
  customerEmail?: string;
  customer_name?: string | null;
  customerName?: string | null;
  plan_name?: string;
  planName?: string;
  name?: string;
  monthly_price?: number | string | null;
  monthlyPrice?: number | string | null;
  credits_per_cycle?: number | string | null;
  creditsPerCycle?: number | string | null;
  renewal_date?: string | null;
  renewalDate?: string | null;
  status?: AdminMembership['status'];
  stripe_subscription_id?: string | null;
  stripeSubscriptionId?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

type RedemptionRow = {
  id?: string;
  customer_email?: string;
  customerEmail?: string;
  event?: { title?: string | null } | null;
  event_title?: string | null;
  eventTitle?: string | null;
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

function isMissingMembershipTable(error: unknown) {
  const backendError = error as BackendError | null;
  const message = `${backendError?.message || ''} ${backendError?.details || ''}`.toLowerCase();
  return backendError?.code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function nextRenewalDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function demoData(): MembershipAdminData {
  const memberships: AdminMembership[] = [
    {
      id: 'demo-membership-1',
      customerEmail: 'raleigh@thenbgroup.com',
      customerName: 'Raleigh Dewan',
      planName: 'Creative Duo',
      monthlyPrice: 49,
      creditsPerCycle: 2,
      renewalDate: nextRenewalDate(),
      status: 'active',
      stripeSubscriptionId: 'demo_sub_creative_duo',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    },
    {
      id: 'demo-membership-2',
      customerEmail: 'alex@example.com',
      customerName: 'Alex Morgan',
      planName: 'Studio Circle',
      monthlyPrice: 89,
      creditsPerCycle: 4,
      renewalDate: nextRenewalDate(),
      status: 'active',
      stripeSubscriptionId: 'demo_sub_studio_circle',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
    },
    {
      id: 'demo-membership-3',
      customerEmail: 'jamie@example.com',
      customerName: 'Jamie Lee',
      planName: 'Creative Duo',
      monthlyPrice: 49,
      creditsPerCycle: 2,
      renewalDate: nextRenewalDate(),
      status: 'past_due',
      stripeSubscriptionId: 'demo_sub_past_due',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 76).toISOString(),
    },
  ];
  const redemptions: AdminMembershipRedemption[] = [
    {
      id: 'demo-redemption-1',
      customerEmail: 'raleigh@thenbgroup.com',
      eventTitle: 'Collaborative Team Canvas',
      orderId: 'demo-order-1',
      creditsUsed: 2,
      amountCovered: 150,
      redeemedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: 'demo-redemption-2',
      customerEmail: 'alex@example.com',
      eventTitle: 'Watercolor Botanicals',
      orderId: 'demo-order-2',
      creditsUsed: 1,
      amountCovered: 65,
      redeemedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
  ];
  return buildData(memberships, redemptions, 'demo');
}

function shouldQueryMembershipBackend() {
  return import.meta.env.VITE_MEMBERSHIP_BACKEND_ENABLED === 'true';
}

function mapMembership(row: MembershipRow): AdminMembership {
  return {
    id: row.id || 'membership',
    customerEmail: row.customer_email || row.customerEmail || '',
    customerName: row.customer_name || row.customerName || null,
    planName: row.plan_name || row.planName || row.name || 'Membership',
    monthlyPrice: Number(row.monthly_price ?? row.monthlyPrice ?? 0),
    creditsPerCycle: Number(row.credits_per_cycle ?? row.creditsPerCycle ?? 0),
    renewalDate: row.renewal_date || row.renewalDate || nextRenewalDate(),
    status: row.status || 'active',
    stripeSubscriptionId: row.stripe_subscription_id || row.stripeSubscriptionId || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function mapRedemption(row: RedemptionRow): AdminMembershipRedemption {
  return {
    id: row.id || 'redemption',
    customerEmail: row.customer_email || row.customerEmail || '',
    eventTitle: row.event?.title || row.event_title || row.eventTitle || null,
    orderId: row.order_id || row.orderId || '',
    creditsUsed: Number(row.credits_used ?? row.creditsUsed ?? 0),
    amountCovered: Number(row.amount_covered ?? row.amountCovered ?? 0),
    redeemedAt: row.redeemed_at || row.redeemedAt || row.created_at || new Date().toISOString(),
  };
}

function buildData(memberships: AdminMembership[], redemptions: AdminMembershipRedemption[], source: 'backend' | 'demo'): MembershipAdminData {
  const activeMemberships = memberships.filter((membership) => membership.status === 'active');
  const monthlyRecurringRevenue = activeMemberships.reduce((sum, membership) => sum + membership.monthlyPrice, 0);
  const creditsIssued = activeMemberships.reduce((sum, membership) => sum + membership.creditsPerCycle, 0);
  const creditsRedeemed = redemptions.reduce((sum, redemption) => sum + redemption.creditsUsed, 0);
  const outstandingCredits = Math.max(creditsIssued - creditsRedeemed, 0);
  const averageCreditValue = activeMemberships.length
    ? activeMemberships.reduce((sum, membership) => sum + (membership.monthlyPrice / Math.max(membership.creditsPerCycle, 1)), 0) / activeMemberships.length
    : 0;

  return {
    memberships,
    redemptions,
    source,
    totals: {
      activeMembers: activeMemberships.length,
      monthlyRecurringRevenue,
      creditsIssued,
      creditsRedeemed,
      outstandingCredits,
      creditLiability: outstandingCredits * averageCreditValue,
    },
  };
}

export function useMembershipAdmin() {
  return useQuery({
    queryKey: ['membershipAdmin'],
    queryFn: async (): Promise<MembershipAdminData> => {
      if (!shouldQueryMembershipBackend()) {
        return demoData();
      }

      const [membershipResult, redemptionResult] = await Promise.all([
        supabase
          .from(CUSTOMER_MEMBERSHIPS_TABLE)
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from(MEMBERSHIP_REDEMPTIONS_TABLE)
          .select('*, event:events(title)')
          .order('redeemed_at', { ascending: false }),
      ]);

      if (isMissingMembershipTable(membershipResult.error) || isMissingMembershipTable(redemptionResult.error)) {
        return demoData();
      }
      if (membershipResult.error) throw membershipResult.error;
      if (redemptionResult.error) throw redemptionResult.error;

      return buildData(
        ((membershipResult.data || []) as MembershipRow[]).map(mapMembership),
        ((redemptionResult.data || []) as RedemptionRow[]).map(mapRedemption),
        'backend'
      );
    },
  });
}
