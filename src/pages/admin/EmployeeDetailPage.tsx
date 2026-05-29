import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useEmployee, useEmployeeStats, useCreateStripeConnectAccount, useDeactivateEmployee } from '../../hooks/useEmployees';
import { useEventAssignments } from '../../hooks/useEventAssignments';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../lib/utils';
import { User, ArrowLeft, Edit, Trash2, CreditCard, Clock, DollarSign, Calendar, TrendingUp, AlertTriangle, Users } from 'lucide-react';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const { data: employee, isLoading: employeeLoading } = useEmployee(id!);
  const { data: stats, isLoading: statsLoading } = useEmployeeStats(id!);
  const { data: assignments, isLoading: assignmentsLoading } = useEventAssignments({ employee_id: id });
  const createStripeConnect = useCreateStripeConnectAccount();
  const deactivateEmployee = useDeactivateEmployee();

  if (employeeLoading || statsLoading || assignmentsLoading) return <LoadingSpinner />;
  if (!employee) return <div style={{ color: 'var(--text-muted)' }}>Employee not found.</div>;

  const handleDeactivate = () => {
    setShowDeactivateConfirm(true);
  };

  const handleConfirmDeactivate = async () => {
    try {
      await deactivateEmployee.mutateAsync(employee.id);
      showToast('Employee deactivated');
    } catch (err: unknown) {
      showToast('Failed to deactivate: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setShowDeactivateConfirm(false);
  };

  const handleConnectStripe = async () => {
    try {
      const result = await createStripeConnect.mutateAsync({ employeeId: employee.id, email: employee.email });
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err: unknown) {
      showToast('Failed to connect Stripe: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const roleVariant = employee.role === 'instructor' ? 'primary' : employee.role === 'artist' ? 'warning' : 'gray';
  const statusVariant = employee.status === 'active' ? 'success' : 'danger';

  const assignmentStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'confirmed': return 'primary';
      case 'declined': return 'danger';
      default: return 'gray';
    }
  };

  const statCards = stats ? [
    { label: 'Total Events Worked', value: stats.totalEvents, icon: Calendar },
    { label: 'Events This Month', value: stats.eventsThisMonth, icon: Calendar },
    { label: 'Total Hours (All-Time)', value: stats.totalHours, icon: Clock },
    { label: 'Hours This Month', value: stats.hoursThisMonth, icon: Clock },
    { label: 'Avg Hours per Event', value: stats.avgHoursPerEvent, icon: TrendingUp },
    { label: 'Total Pay Earned', value: formatCurrency(stats.totalPayEarned), icon: DollarSign },
    { label: 'Total Paid', value: formatCurrency(stats.totalPaid), icon: DollarSign },
    { label: 'Outstanding', value: formatCurrency(stats.outstanding), icon: DollarSign },
    { label: 'No-Shows / Declines', value: stats.declined, icon: AlertTriangle },
  ] : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/employees')} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {employee.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={roleVariant}>{employee.role}</Badge>
            <Badge variant={statusVariant}>{employee.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/admin/employees/${employee.id}/edit`)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {employee.status === 'active' && (
            <Button variant="danger" onClick={handleDeactivate} disabled={deactivateEmployee.isPending}>
              <Trash2 className="h-4 w-4 mr-1" />
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            Stripe Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.stripe_onboarding_complete ? (
            <div className="flex items-center gap-2">
              <Badge variant="success">Connected</Badge>
              {employee.stripe_account_id && (
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  ••••{employee.stripe_account_id.slice(-4)}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Not connected</span>
              <Button onClick={handleConnectStripe} disabled={createStripeConnect.isPending}>
                <CreditCard className="h-4 w-4 mr-2" />
                Connect Stripe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {employee.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {employee.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {!employee.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            Event History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No event assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Event</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Clock In</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Clock Out</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Hours</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Rate</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Pay</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="py-2 px-3" style={{ color: 'var(--text-primary)' }}>
                        {a.event?.title || '—'}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>
                        {a.event?.start_datetime ? new Date(a.event.start_datetime).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>
                        {a.clock_in ? new Date(a.clock_in).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>
                        {a.clock_out ? new Date(a.clock_out).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: 'var(--text-primary)' }}>
                        {a.hours_worked != null ? a.hours_worked : '—'}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: 'var(--text-primary)' }}>
                        {a.hourly_rate_snapshot != null ? formatCurrency(a.hourly_rate_snapshot) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: 'var(--text-primary)' }}>
                        {a.pay_amount != null ? formatCurrency(a.pay_amount) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={assignmentStatusVariant(a.status)}>{a.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate Employee"
        message="Are you sure you want to deactivate this employee?"
        confirmLabel="Deactivate"
        variant="warning"
        icon="warning"
        isLoading={deactivateEmployee.isPending}
      />
    </div>
  );
}
