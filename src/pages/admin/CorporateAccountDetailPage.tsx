import { useParams, useNavigate } from 'react-router-dom';
import { useCorporateAccount, useCorporateAccountEvents, useCorporateAccountInvoices } from '../../hooks/useCorporateAccounts';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { Building2, ArrowLeft, Edit, Calendar, DollarSign, FileText, CreditCard } from 'lucide-react';

export default function CorporateAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: account, isLoading: accountLoading } = useCorporateAccount(id!);
  const { data: events, isLoading: eventsLoading } = useCorporateAccountEvents(id!);
  const { data: invoices, isLoading: invoicesLoading } = useCorporateAccountInvoices(id!);

  if (accountLoading || eventsLoading || invoicesLoading) return <LoadingSpinner />;
  if (!account) return <div style={{ color: 'var(--text-muted)' }}>Corporate account not found.</div>;

  const planVariant = account.plan_type === 'monthly_retainer' ? 'primary' : account.plan_type === 'pay_per_event' ? 'warning' : 'gray';
  const statusVariant = account.status === 'active' ? 'success' : account.status === 'paused' ? 'warning' : 'danger';

  const planLabel = account.plan_type === 'monthly_retainer' ? 'Monthly Retainer' : account.plan_type === 'pay_per_event' ? 'Pay Per Event' : 'Custom';

  const outstandingInvoices = invoices?.filter((i) => i.status === 'sent' || i.status === 'past_due') || [];
  const totalSpendYTD = invoices?.filter((i) => i.status === 'paid' && new Date(i.paid_at!).getFullYear() === new Date().getFullYear()).reduce((sum, i) => sum + i.total_amount, 0) || 0;

  const invoiceStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'past_due': return 'danger';
      case 'sent': return 'warning';
      case 'draft': return 'gray';
      case 'voided': return 'danger';
      default: return 'gray';
    }
  };

  const eventStatusVariant = (status: string) => {
    switch (status) {
      case 'converted_to_event': return 'success';
      case 'confirmed': return 'primary';
      case 'cancelled': return 'danger';
      default: return 'gray';
    }
  };

  const address = account.billing_address;
  const addressString = address
    ? `${address.street}, ${address.city}, ${address.state} ${address.zip}`
    : null;

  const statCards = [
    { label: 'Total Spend YTD', value: formatCurrency(totalSpendYTD), icon: DollarSign },
    { label: 'Active Events', value: events?.length ?? 0, icon: Calendar },
    { label: 'Outstanding Invoices', value: outstandingInvoices.length, icon: FileText },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/corporate-accounts')} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {account.company_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={planVariant}>{planLabel}</Badge>
            <Badge variant={statusVariant}>{account.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/admin/corporate-accounts/${account.id}/edit`)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/private-requests')}>
            <Calendar className="h-4 w-4 mr-1" />
            Book Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <Icon className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              Company Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Contact Name</span>
                <span style={{ color: 'var(--text-primary)' }}>{account.primary_contact_name}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <span style={{ color: 'var(--text-primary)' }}>{account.primary_contact_email}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Phone</span>
                <span style={{ color: 'var(--text-primary)' }}>{account.primary_contact_phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Billing Address</span>
                <span style={{ color: 'var(--text-primary)' }}>{addressString || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Tax ID</span>
                <span style={{ color: 'var(--text-primary)' }}>{account.tax_id || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            {account.stripe_customer_id ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Stripe Customer ID</span>
                  <span style={{ color: 'var(--text-primary)' }}>{account.stripe_customer_id}</span>
                </div>
                {account.stripe_subscription_id && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Stripe Subscription ID</span>
                    <span style={{ color: 'var(--text-primary)' }}>{account.stripe_subscription_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Auto Charge</span>
                  <Badge variant={account.auto_charge ? 'success' : 'gray'}>{account.auto_charge ? 'Enabled' : 'Disabled'}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No payment method on file</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            Event History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events linked to this account.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Event</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Venue</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="py-2 px-3" style={{ color: 'var(--text-primary)' }}>
                        {e.title || '—'}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>
                        {e.preferred_datetime ? new Date(e.preferred_datetime).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>
                        {e.venue?.name || '—'}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={eventStatusVariant(e.status)}>{e.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!invoices || invoices.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Period</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Amount</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Due Date</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="py-2 px-3" style={{ color: 'var(--text-primary)' }}>
                        {new Date(inv.billing_period_start).toLocaleDateString()} – {new Date(inv.billing_period_end).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={invoiceStatusVariant(inv.status)}>{inv.status}</Badge>
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/corporate-invoices')}>
                          View
                        </Button>
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
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {account.notes ? (
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {account.notes}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}