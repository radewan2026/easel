import { useState, useMemo } from 'react';
import { useTimeEntries, getEntryHours, calculatePay } from '../../hooks/useTimeEntries';
import { useAccounts } from '../../hooks/useAdmin';
import { formatCurrency } from '../../lib/utils';
import { Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import type { Account, TimeEntry } from '../../types/database';

type Period = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';
type PayrollEmployeeRow = {
  id: string;
  name: string;
  email: string;
  role: Account['role'];
  hourlyRate: number;
  overtimeMultiplier: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  entries: number;
};

function getPeriodRange(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'thisWeek': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      return { from: start.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    }
    case 'lastWeek': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
    case 'thisMonth': {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
    case 'custom':
      return { from: customFrom || '', to: customTo || '' };
  }
}

export default function PayrollReportPage() {
  const { data: entries, isLoading: entriesLoading } = useTimeEntries();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const [period, setPeriod] = useState<Period>('thisWeek');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const employeeData = useMemo<PayrollEmployeeRow[]>(() => {
    if (!entries || !accounts) return [];
    const filtered = entries.filter((e) => {
      if (!e.clock_out) return false;
      if (from && e.clock_in < from) return false;
      if (to && e.clock_in > to + 'T23:59:59') return false;
      return true;
    });

    const byAccount = new Map<string, TimeEntry[]>();
    filtered.forEach((e) => {
      const existing = byAccount.get(e.account_id) || [];
      existing.push(e);
      byAccount.set(e.account_id, existing);
    });

    return accounts
      .filter((a: Account) => a.role !== 'admin' && a.hourly_rate != null)
      .map((a: Account) => {
        const empEntries = byAccount.get(a.id) || [];
        const { regularHours, overtimeHours, regularPay, overtimePay, totalPay } = calculatePay(empEntries, 40);
        const totalHours = empEntries.reduce((sum, e) => sum + getEntryHours(e), 0);
        return {
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          hourlyRate: a.hourly_rate!,
          overtimeMultiplier: a.overtime_multiplier,
          totalHours: Math.round(totalHours * 100) / 100,
          regularHours,
          overtimeHours,
          regularPay,
          overtimePay,
          totalPay,
          entries: empEntries.length,
        };
      })
      .filter((e) => e.totalHours > 0 || period === 'custom')
      .sort((a, b) => b.totalPay - a.totalPay);
  }, [entries, accounts, from, to, period]);

  const totals = useMemo(() => ({
    totalHours: employeeData.reduce((s, e) => s + e.totalHours, 0),
    regularHours: employeeData.reduce((s, e) => s + e.regularHours, 0),
    overtimeHours: employeeData.reduce((s, e) => s + e.overtimeHours, 0),
    regularPay: employeeData.reduce((s, e) => s + e.regularPay, 0),
    overtimePay: employeeData.reduce((s, e) => s + e.overtimePay, 0),
    totalPay: employeeData.reduce((s, e) => s + e.totalPay, 0),
  }), [employeeData]);

  const exportCSV = () => {
    const headers = ['Employee', 'Email', 'Role', 'Hourly Rate', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Regular Pay', 'Overtime Pay', 'Total Pay'];
    const rows = employeeData.map((e) => [
      e.name, e.email, e.role, e.hourlyRate, e.totalHours, e.regularHours, e.overtimeHours, e.regularPay, e.overtimePay, e.totalPay,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (entriesLoading || accountsLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Payroll Report</h1>
          <p style={{ color: 'var(--text-muted)' }}>Employee hours and earnings summary</p>
        </div>
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <Select
          options={[
            { value: 'thisWeek', label: 'This Week' },
            { value: 'lastWeek', label: 'Last Week' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'lastMonth', label: 'Last Month' },
            { value: 'custom', label: 'Custom Range' },
          ]}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="w-48"
        />
        {period === 'custom' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>From:</span>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>To:</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Hours</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totals.totalHours.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Regular Hours</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totals.regularHours.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Overtime Hours</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totals.overtimeHours.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Regular Pay</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.regularPay)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Pay</p><p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(totals.totalPay)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Summary ({from && to ? `${from} to ${to}` : 'Select a period'})</CardTitle>
        </CardHeader>
        <CardContent>
          {employeeData.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No paid time entries found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Employee</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Rate</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Total Hrs</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Reg Hrs</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>OT Hrs</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>OT Mult</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Reg Pay</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>OT Pay</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Total Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeData.map((emp) => (
                    <tr key={emp.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                        <div className="font-medium">{emp.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{emp.email}</div>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(emp.hourlyRate)}/hr</td>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{emp.totalHours.toFixed(2)}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{emp.regularHours.toFixed(2)}</td>
                      <td className="py-3 px-4" style={{ color: emp.overtimeHours > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
                        {emp.overtimeHours.toFixed(2)}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{emp.overtimeMultiplier}×</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(emp.regularPay)}</td>
                      <td className="py-3 px-4" style={{ color: emp.overtimePay > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
                        {formatCurrency(emp.overtimePay)}
                      </td>
                      <td className="py-3 px-4 font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(emp.totalPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-primary)' }}>Totals</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>—</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-primary)' }}>{totals.totalHours.toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-primary)' }}>{totals.regularHours.toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-secondary)' }}>{totals.overtimeHours.toFixed(2)}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>—</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.regularPay)}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(totals.overtimePay)}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(totals.totalPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
