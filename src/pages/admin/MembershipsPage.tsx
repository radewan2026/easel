import { Calendar, CreditCard, Database, DollarSign, History, Ticket, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useMembershipAdmin } from '../../hooks/useMembershipAdmin';
import { formatCurrency, formatDateTime } from '../../lib/utils';

function statusVariant(status: string) {
  if (status === 'active') return 'success';
  if (status === 'past_due') return 'warning';
  if (status === 'canceled') return 'danger';
  return 'gray';
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--admin-input-bg)', color: 'var(--primary-color)' }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MembershipsPage() {
  const { data, isLoading, error } = useMembershipAdmin();

  if (isLoading) return <LoadingSpinner />;

  if (error || !data) {
    return (
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Memberships unavailable</h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>Membership tables or permissions may need to be configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Memberships</h1>
            <Badge variant={data.source === 'backend' ? 'success' : 'warning'}>
              {data.source === 'backend' ? 'Synced ledger' : 'Demo ledger'}
            </Badge>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Track subscriptions, issued credits, redemptions, and outstanding credit liability.
          </p>
        </div>
      </div>

      {data.source !== 'backend' && (
        <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--card-bg)', color: '#d97706' }}>
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Membership backend is not connected yet</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              This page is showing demo ledger data. Apply the Supabase migration at <code>supabase/migrations/20260523104500_membership_credit_ledger.sql</code>, then enable <code>VITE_MEMBERSHIP_BACKEND_ENABLED=true</code>.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Users} label="Active members" value={String(data.totals.activeMembers)} detail={`${data.memberships.length} total records`} />
        <MetricCard icon={DollarSign} label="Monthly recurring" value={formatCurrency(data.totals.monthlyRecurringRevenue)} detail="Active plans only" />
        <MetricCard icon={Ticket} label="Credits issued" value={String(data.totals.creditsIssued)} detail="Current cycle estimate" />
        <MetricCard icon={History} label="Credits redeemed" value={String(data.totals.creditsRedeemed)} detail={`${data.redemptions.length} redemption records`} />
        <MetricCard icon={CreditCard} label="Credit liability" value={formatCurrency(data.totals.creditLiability)} detail={`${data.totals.outstandingCredits} outstanding credits`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Customer Memberships</CardTitle>
          </CardHeader>
          <CardContent>
            {data.memberships.length === 0 ? (
              <div className="py-10 text-center">
                <Ticket className="mx-auto h-10 w-10" style={{ color: 'var(--text-muted)' }} />
                <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>No memberships yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderColor: 'var(--border-color)' }}>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Customer</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Plan</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Credits</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Renews</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.memberships.map((membership) => (
                      <tr key={membership.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{membership.customerName || membership.customerEmail}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{membership.customerEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{membership.planName}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(membership.monthlyPrice)} / month</p>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{membership.creditsPerCycle} / cycle</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <Calendar className="h-4 w-4" />
                            {formatDateTime(membership.renewalDate)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(membership.status)}>{membership.status.replace('_', ' ')}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Credit Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.redemptions.length === 0 ? (
              <div className="py-10 text-center">
                <History className="mx-auto h-10 w-10" style={{ color: 'var(--text-muted)' }} />
                <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>No credit redemptions yet.</p>
              </div>
            ) : (
              data.redemptions.slice(0, 8).map((redemption) => (
                <div key={redemption.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{redemption.customerEmail}</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {redemption.eventTitle || 'Event order'} · {formatDateTime(redemption.redeemedAt)}
                      </p>
                    </div>
                    <Badge variant="primary">{redemption.creditsUsed} credit{redemption.creditsUsed === 1 ? '' : 's'}</Badge>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: 'var(--primary-color)' }}>{formatCurrency(redemption.amountCovered)} covered</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
