import { useState, useMemo } from 'react';
import { useTimeEntries, useCreateTimeEntry, useUpdateTimeEntry, useDeleteTimeEntry, getEntryHours, formatLocation, getMapUrl } from '../../hooks/useTimeEntries';
import { useAccounts } from '../../hooks/useAdmin';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import type { Account, TimeEntry } from '../../types/database';
import { ReasonConfirmDialog } from '../../components/ui/ReasonConfirmDialog';
import { logActivity } from '../../lib/activityLog';

type SortField = 'employee' | 'clock_in' | 'clock_out' | 'hours';
type SortDirection = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc'
    ? <ArrowUp className="h-4 w-4 ml-1 inline" style={{ color: 'var(--primary-color)' }} />
    : <ArrowDown className="h-4 w-4 ml-1 inline" style={{ color: 'var(--primary-color)' }} />;
}

export default function TimeTrackingPage() {
  const { data: entries, isLoading } = useTimeEntries();
  const { data: accounts } = useAccounts();
  const createTimeEntry = useCreateTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const { showToast } = useToast();

  const [sortField, setSortField] = useState<SortField>('clock_in');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const pageSize = 25;

  const [formData, setFormData] = useState({
    accountId: '',
    clockIn: '',
    clockOut: '',
    notes: '',
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filtered = useMemo(() => {
    if (!entries) return [];
    let result = [...entries];
    if (filterAccount) result = result.filter((e) => e.account_id === filterAccount);
    if (filterStatus === 'active') result = result.filter((e) => !e.clock_out);
    if (filterStatus === 'complete') result = result.filter((e) => e.clock_out);
    if (dateFrom) result = result.filter((e) => e.clock_in >= dateFrom);
    if (dateTo) result = result.filter((e) => e.clock_in <= dateTo + 'T23:59:59');
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'employee': aVal = a.account?.name || ''; bVal = b.account?.name || ''; break;
        case 'clock_in': aVal = a.clock_in; bVal = b.clock_in; break;
        case 'clock_out': aVal = a.clock_out || ''; bVal = b.clock_out || ''; break;
        case 'hours': aVal = getEntryHours(a); bVal = getEntryHours(b); break;
        default: return 0;
      }
      if (aVal === bVal) return 0;
      const c = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? c : -c;
    });
    return result;
  }, [entries, filterAccount, filterStatus, dateFrom, dateTo, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = () => {
    setEditingEntry(null);
    setFormData({ accountId: accounts?.[0]?.id || '', clockIn: new Date().toISOString().slice(0, 16), clockOut: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setFormData({
      accountId: entry.account_id,
      clockIn: entry.clock_in ? entry.clock_in.slice(0, 16) : '',
      clockOut: entry.clock_out ? entry.clock_out.slice(0, 16) : '',
      notes: entry.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingEntry) {
        await updateTimeEntry.mutateAsync({
          id: editingEntry.id,
          clock_in: formData.clockIn,
          clock_out: formData.clockOut || null,
          notes: formData.notes || null,
        });
        showToast('Entry updated');
      } else {
        await createTimeEntry.mutateAsync({
          accountId: formData.accountId,
          clockIn: formData.clockIn,
          clockOut: formData.clockOut || undefined,
          notes: formData.notes || undefined,
        });
        showToast('Entry created');
      }
      setShowModal(false);
    } catch (err: unknown) {
      showToast('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (reason: string) => {
    if (deleteTarget) {
      await deleteTimeEntry.mutateAsync(deleteTarget);
      await logActivity({
        action: 'time_entry.deleted',
        entityType: 'time_entry',
        entityId: deleteTarget,
        details: { reason: reason || 'No reason provided', guardrail: true },
      });
      showToast('Entry deleted');
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const activeEntries = filtered.filter((entry) => !entry.clock_out).length;
  const completedEntries = filtered.filter((entry) => entry.clock_out).length;
  const totalEarned = filtered.reduce((sum, entry) => {
    const hours = getEntryHours(entry);
    const rate = entry.account?.hourly_rate;
    return rate != null && entry.clock_out ? sum + hours * rate : sum;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Time Tracking</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and manage all employee time entries</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Select
          options={[{ value: '', label: 'All Employees' }, ...(accounts?.map((a: Account) => ({ value: a.id, label: a.name })) || [])]}
          value={filterAccount}
          onChange={(e) => { setFilterAccount(e.target.value); setPage(1); }}
          className="w-48"
        />
        <Select
          options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'complete', label: 'Complete' }]}
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="w-36"
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>From:</span>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>To:</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Active Entries</p>
            <p className="text-2xl font-bold" style={{ color: activeEntries ? '#d97706' : 'var(--text-primary)' }}>{activeEntries}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Completed Entries</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{completedEntries}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Estimated Earned</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(totalEarned)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Time Entries</CardTitle>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} position="top" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('employee')}>Employee <SortIcon field="employee" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('clock_in')}>Clock In <SortIcon field="clock_in" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('clock_out')}>Clock Out <SortIcon field="clock_out" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('hours')}>Hours <SortIcon field="hours" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Rate</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Earned</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Location</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((entry) => {
                  const hours = getEntryHours(entry);
                  const rate = entry.account?.hourly_rate;
                  const earned = rate != null && entry.clock_out ? hours * rate : null;
                  return (
                    <tr key={entry.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                        {entry.account?.name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(entry.clock_in)}</td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {entry.clock_out ? formatDateTime(entry.clock_out) : <span style={{ color: '#f59e0b' }}>Active</span>}
                      </td>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {entry.clock_out ? hours.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {rate != null ? formatCurrency(rate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: earned != null ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                        {earned != null ? formatCurrency(earned) : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {entry.latitude != null && entry.longitude != null ? (
                          <a href={getMapUrl(entry) || '#'} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary-color)' }}>
                            📍 {formatLocation(entry)}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {entry.clock_out ? (
                          <Badge variant="success">Complete</Badge>
                        ) : (
                          <Badge variant="warning">Active</Badge>
                        )}
                        {entry.is_manual && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>Manual</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" aria-label="Edit time entry" onClick={() => openEdit(entry)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" aria-label="Delete time entry" onClick={() => handleDelete(entry.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} position="bottom" />
        </CardContent>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingEntry ? 'Edit Time Entry' : 'Add Time Entry'} className="max-w-lg">
        <div className="space-y-4">
          {!editingEntry && (
            <Select
              label="Employee"
              options={[{ value: '', label: 'Select employee' }, ...(accounts?.map((a: Account) => ({ value: a.id, label: a.name })) || [])]}
              value={formData.accountId}
              onChange={(e) => setFormData((prev) => ({ ...prev, accountId: e.target.value }))}
            />
          )}
          <Input
            label="Clock In"
            type="datetime-local"
            value={formData.clockIn}
            onChange={(e) => setFormData((prev) => ({ ...prev, clockIn: e.target.value }))}
          />
          <div>
            <Input
              label="Clock Out (leave blank for active entry)"
              type="datetime-local"
              value={formData.clockOut}
              onChange={(e) => setFormData((prev) => ({ ...prev, clockOut: e.target.value }))}
            />
            {!editingEntry && !formData.clockOut && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Leave blank to create an active clock-in entry.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              rows={3}
              placeholder="Admin correction, reason for manual entry, etc."
            />
          </div>
          {editingEntry && editingEntry.latitude != null && editingEntry.longitude != null && (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              📍 Clock-in location: <a href={getMapUrl(editingEntry) || '#'} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary-color)' }}>{formatLocation(editingEntry)}</a>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createTimeEntry.isPending || updateTimeEntry.isPending}>
              {editingEntry ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <ReasonConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Time Entry"
        message="Deleting a time entry can affect payroll calculations. Add a reason for the audit trail."
        reasonLabel="Delete reason"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
        isLoading={deleteTimeEntry.isPending}
        requireReason
      />
    </div>
  );
}
