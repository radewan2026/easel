import { useState } from 'react';
import { DollarSign, Clock, CheckCircle, XCircle, AlertTriangle, Download, CreditCard, Send, Edit } from 'lucide-react';
import { usePayRecords, useApprovePayRecord, useDispatchPayRecord, useBulkDispatchPay, useRetryFailedPayment, useUpdatePayRecord } from '../../hooks/usePayRecords';
import { formatCurrency } from '../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ReasonConfirmDialog } from '../../components/ui/ReasonConfirmDialog';
import type { PayRecord } from '../../types/database';
import { logActivity } from '../../lib/activityLog';

type PayTab = 'pending' | 'approved' | 'paid' | 'failed';

const STATUS_BADGE: Record<string, { variant: 'primary' | 'success' | 'warning' | 'danger' | 'gray'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'primary', label: 'Approved' },
  paid: { variant: 'success', label: 'Paid' },
  failed: { variant: 'danger', label: 'Failed' },
};

const TABS: { id: PayTab; label: string; icon: typeof Clock }[] = [
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'approved', label: 'Approved', icon: CheckCircle },
  { id: 'paid', label: 'Paid', icon: DollarSign },
  { id: 'failed', label: 'Failed', icon: XCircle },
];

export default function PayQueuePage() {
  const [activeTab, setActiveTab] = useState<PayTab>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [paidDateFrom, setPaidDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [paidDateTo, setPaidDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [editingRecord, setEditingRecord] = useState<PayRecord | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editHoursWorked, setEditHoursWorked] = useState('');
  const [editPayAmount, setEditPayAmount] = useState('');
  const [payOverrideNote, setPayOverrideNote] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [payAction, setPayAction] = useState<{ type: 'approve' | 'dispatch' | 'retry'; record: PayRecord } | null>(null);

  const { data: pendingRecords, isLoading: pendingLoading } = usePayRecords({ status: 'pending' });
  const { data: approvedRecords, isLoading: approvedLoading } = usePayRecords({ status: 'approved' });
  const { data: paidRecords, isLoading: paidLoading } = usePayRecords({ status: 'paid' });
  const { data: failedRecords, isLoading: failedLoading } = usePayRecords({ status: 'failed' });

  const approveMutation = useApprovePayRecord();
  const dispatchMutation = useDispatchPayRecord();
  const bulkDispatchMutation = useBulkDispatchPay();
  const retryMutation = useRetryFailedPayment();
  const updateMutation = useUpdatePayRecord();

  const isLoading = pendingLoading || approvedLoading || paidLoading || failedLoading;
  if (isLoading) return <LoadingSpinner />;

  const openEditModal = (record: PayRecord) => {
    setEditingRecord(record);
    const assignment = record.assignment as Record<string, unknown> | undefined;
    setEditClockIn(assignment?.clock_in ? String(assignment.clock_in).slice(0, 16) : '');
    setEditClockOut(assignment?.clock_out ? String(assignment.clock_out).slice(0, 16) : '');
    setEditHoursWorked(String(record.hours_worked));
    setEditPayAmount(String(record.pay_amount));
    setPayOverrideNote(false);
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    const updates: Record<string, unknown> = {
      id: editingRecord.id,
      hours_worked: Number(editHoursWorked),
      pay_amount: Number(editPayAmount),
    };
    if (editClockIn) updates.clock_in = new Date(editClockIn).toISOString();
    if (editClockOut) updates.clock_out = new Date(editClockOut).toISOString();
    const computedPay = Number(editHoursWorked) * editingRecord.hourly_rate;
    if (Math.abs(Number(editPayAmount) - computedPay) > 0.01) {
      updates.pay_override = true;
    }
    updateMutation.mutate(updates as Partial<PayRecord> & { id: string }, {
      onSuccess: () => setEditingRecord(null),
    });
  };

  const recalcFromClock = () => {
    if (!editClockIn || !editClockOut) return;
    const inMs = new Date(editClockIn).getTime();
    const outMs = new Date(editClockOut).getTime();
    if (outMs > inMs) {
      const hours = (outMs - inMs) / (1000 * 60 * 60);
      setEditHoursWorked(hours.toFixed(2));
      if (editingRecord) {
        setEditPayAmount((hours * editingRecord.hourly_rate).toFixed(2));
        setPayOverrideNote(false);
      }
    }
  };

  const currentRecords = (() => {
    switch (activeTab) {
      case 'pending': return pendingRecords ?? [];
      case 'approved': return approvedRecords ?? [];
      case 'paid': {
        const all = paidRecords ?? [];
        const from = new Date(paidDateFrom).getTime();
        const to = new Date(paidDateTo + 'T23:59:59').getTime();
        return all.filter((r) => {
          const t = new Date(r.paid_at ?? r.created_at).getTime();
          return t >= from && t <= to;
        });
      }
      case 'failed': return failedRecords ?? [];
    }
  })();

  const totalPages = Math.max(1, Math.ceil(currentRecords.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedRecords = currentRecords.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedRecords.map((r) => r.id));
    }
  };

  const exportCSV = () => {
    const headers = ['Event', 'Date', 'Employee', 'Clock In', 'Clock Out', 'Hours Worked', 'Hourly Rate', 'Pay Amount', 'Status'];
    const rows = currentRecords.map((r) => {
      const assignment = r.assignment as Record<string, unknown> | undefined;
      return [
        `"${r.event?.title ?? ''}"`,
        r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        `"${r.employee?.name ?? ''}"`,
        assignment?.clock_in ? new Date(assignment.clock_in as string).toLocaleString() : '',
        assignment?.clock_out ? new Date(assignment.clock_out as string).toLocaleString() : '',
        r.hours_worked,
        r.hourly_rate,
        r.pay_amount,
        r.status,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pay-records-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
            {activeTab === 'approved' && (
              <th className="py-3 px-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.length === paginatedRecords.length && paginatedRecords.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
            )}
            <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Event</th>
            <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Date</th>
            <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Employee</th>
            <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Clock In</th>
            <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Clock Out</th>
            <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Hours</th>
            <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Rate</th>
            <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Pay</th>
            <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Status</th>
            <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRecords.length === 0 ? (
            <tr>
              <td colSpan={activeTab === 'approved' ? 11 : 10} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No records found
              </td>
            </tr>
          ) : (
            paginatedRecords.map((record) => {
              const emp = record.employee as Record<string, unknown> | undefined;
              const evt = record.event as Record<string, unknown> | undefined;
              const asgn = record.assignment as Record<string, unknown> | undefined;
              const badgeInfo = STATUS_BADGE[record.status] ?? { variant: 'gray' as const, label: record.status };
              return (
                <tr key={record.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  {activeTab === 'approved' && (
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {(evt?.title as string) ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {record.created_at ? new Date(record.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                    {(emp?.name as string) ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {asgn?.clock_in ? new Date(asgn.clock_in as string).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {asgn?.clock_out ? new Date(asgn.clock_out as string).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                    {record.hours_worked}
                  </td>
                  <td className="py-3 px-4 text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(record.hourly_rate)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                    {record.pay_override && <AlertTriangle className="inline h-3.5 w-3.5 mr-1 text-yellow-500" />}
                    {formatCurrency(record.pay_amount)}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {renderActions(record)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const renderActions = (record: PayRecord) => {
    const emp = record.employee as Record<string, unknown> | undefined;
    switch (activeTab) {
      case 'pending':
        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEditModal(record)}>
              <Edit className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPayAction({ type: 'approve', record })}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
          </div>
        );
      case 'approved':
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setPayAction({ type: 'dispatch', record })}
            disabled={dispatchMutation.isPending}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Pay Now
          </Button>
        );
      case 'paid':
        return null;
      case 'failed':
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPayAction({ type: 'retry', record })}
              disabled={retryMutation.isPending}
            >
              Retry
            </Button>
            {Boolean(emp?.email) && (
              <a
                href={`mailto:${emp?.email ?? ''}`}
                className="text-sm underline"
                style={{ color: 'var(--primary-color)' }}
              >
                Contact
              </a>
            )}
          </div>
        );
    }
  };

  const selectedRecordsForBulk = currentRecords.filter((r) => selectedIds.includes(r.id));

  const handlePayActionConfirm = async (reason: string) => {
    if (!payAction) return;
    const { type, record } = payAction;
    const emp = record.employee as Record<string, unknown> | undefined;
    const details = { reason: reason || 'No reason provided', employee: emp?.name, amount: record.pay_amount, guardrail: true };
    if (type === 'approve') {
      await approveMutation.mutateAsync(record.id);
      await logActivity({ action: 'payroll.approved', entityType: 'pay_record', entityId: record.id, entityName: String(emp?.name || 'Pay record'), details });
    } else if (type === 'dispatch') {
      await dispatchMutation.mutateAsync(record.id);
      await logActivity({ action: 'payroll.dispatched', entityType: 'pay_record', entityId: record.id, entityName: String(emp?.name || 'Pay record'), details });
    } else {
      await retryMutation.mutateAsync(record.id);
      await logActivity({ action: 'payroll.retry_queued', entityType: 'pay_record', entityId: record.id, entityName: String(emp?.name || 'Pay record'), details });
    }
    setPayAction(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Pay Queue</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage employee pay records and disbursements</p>
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setCurrentPage(1); setSelectedIds([]); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: activeTab === tab.id ? 'white' : 'var(--text-primary)',
              }}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'paid' && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>From</span>
            <input
              type="date"
              value={paidDateFrom}
              onChange={(e) => setPaidDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>To</span>
            <input
              type="date"
              value={paidDateTo}
              onChange={(e) => setPaidDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      )}

      {activeTab === 'approved' && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {selectedIds.length} selected
          </span>
          <Button variant="primary" size="sm" onClick={() => setShowBulkConfirm(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay Selected
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {activeTab === 'pending' && 'Pending Pay Records'}
            {activeTab === 'approved' && 'Approved Pay Records'}
            {activeTab === 'paid' && 'Paid History'}
            {activeTab === 'failed' && 'Failed Payments'}
          </CardTitle>
          <Pagination
            currentPage={currentPageSafe}
            totalPages={totalPages}
            totalItems={currentRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="top"
          />
        </CardHeader>
        <CardContent>
          {activeTab === 'failed' && currentRecords.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-red-200" style={{ backgroundColor: '#fef2f2' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">
                  {currentRecords.length} failed payment{currentRecords.length !== 1 ? 's' : ''} require attention
                </span>
              </div>
            </div>
          )}

          {renderTable()}

          <Pagination
            currentPage={currentPageSafe}
            totalPages={totalPages}
            totalItems={currentRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="bottom"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        title="Edit Pay Record"
      >
        {editingRecord && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Clock In</label>
              <input
                type="datetime-local"
                value={editClockIn}
                onChange={(e) => { setEditClockIn(e.target.value); recalcFromClock(); }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Clock Out</label>
              <input
                type="datetime-local"
                value={editClockOut}
                onChange={(e) => { setEditClockOut(e.target.value); recalcFromClock(); }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Hours Worked</label>
              <input
                type="number"
                step="0.01"
                value={editHoursWorked}
                onChange={(e) => {
                  setEditHoursWorked(e.target.value);
                  const newHours = Number(e.target.value);
                  const newPay = newHours * editingRecord.hourly_rate;
                  setEditPayAmount(newPay.toFixed(2));
                  setPayOverrideNote(false);
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Pay Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={editPayAmount}
                onChange={(e) => {
                  setEditPayAmount(e.target.value);
                  const computed = Number(editHoursWorked) * editingRecord.hourly_rate;
                  setPayOverrideNote(Math.abs(Number(e.target.value) - computed) > 0.01);
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              {payOverrideNote && (
                <p className="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Pay amount differs from calculated pay — this will be flagged as a pay override.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>Rate: {formatCurrency(editingRecord.hourly_rate)}/hr</span>
              <span>·</span>
              <span>Computed: {formatCurrency(Number(editHoursWorked) * editingRecord.hourly_rate)}</span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setEditingRecord(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        title="Confirm Bulk Payment"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You are about to disburse payment for {selectedIds.length} employee{selectedIds.length !== 1 ? 's' : ''}:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {selectedRecordsForBulk.map((record) => {
              const emp = record.employee as Record<string, unknown> | undefined;
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {(emp?.name as string) ?? 'Unknown'}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(record.pay_amount)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between">
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Total</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(selectedRecordsForBulk.reduce((sum, r) => sum + r.pay_amount, 0))}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                await bulkDispatchMutation.mutateAsync(selectedIds);
                await logActivity({
                  action: 'payroll.bulk_dispatched',
                  entityType: 'pay_record',
                  details: {
                    count: selectedIds.length,
                    amount: selectedRecordsForBulk.reduce((sum, r) => sum + r.pay_amount, 0),
                    guardrail: true,
                  },
                });
                setSelectedIds([]);
                setShowBulkConfirm(false);
              }}
              disabled={bulkDispatchMutation.isPending}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {bulkDispatchMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      <ReasonConfirmDialog
        isOpen={!!payAction}
        onClose={() => setPayAction(null)}
        onConfirm={handlePayActionConfirm}
        title={
          payAction?.type === 'approve'
            ? 'Approve Pay Record'
            : payAction?.type === 'dispatch'
              ? 'Pay Employee Now'
              : 'Retry Failed Payment'
        }
        message={
          payAction?.type === 'approve'
            ? 'This approves the pay record and makes it eligible for payment. Add a note for payroll audit context.'
            : payAction?.type === 'dispatch'
              ? 'This may trigger a payment transfer. Confirm the amount and add a note for the payroll audit trail.'
              : 'This moves the failed payment back for retry. Add what changed before retrying.'
        }
        reasonLabel="Payroll note"
        confirmLabel={payAction?.type === 'dispatch' ? 'Pay Now' : 'Confirm'}
        variant={payAction?.type === 'dispatch' ? 'warning' : 'info'}
        icon="warning"
        isLoading={approveMutation.isPending || dispatchMutation.isPending || retryMutation.isPending}
      />
    </div>
  );
}
