import { useState, useMemo, useEffect } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useSubmissions, useUpdateSubmissionStatus, useDeleteSubmission } from '../../hooks/useSubmissions';
import { formatDateTime } from '../../lib/utils';
import { Inbox, Eye, Trash2, Mail, Phone, CalendarDays, Users, FileText, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import type { Submission, SubmissionStatus } from '../../types/database';

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
  new: 'warning',
  contacted: 'success',
  booked: 'success',
  archived: 'gray',
};

type SortField = 'name' | 'email' | 'preferred_date' | 'group_size' | 'status' | 'created_at';

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: 'asc' | 'desc' }) {
  if (currentField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return direction === 'asc' ? <ChevronUp className="h-4 w-4 ml-1 inline" /> : <ChevronDown className="h-4 w-4 ml-1 inline" />;
}

export default function SubmissionsPage() {
  const { data: submissions, isLoading } = useSubmissions();
  const updateStatus = useUpdateSubmissionStatus();
  const deleteSubmission = useDeleteSubmission();
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filtered = useMemo(() => {
    const result = submissions?.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    }) || [];

    return [...result].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        case 'preferred_date':
          aVal = a.preferred_date || '';
          bVal = b.preferred_date || '';
          break;
        case 'group_size':
          aVal = a.group_size || 0;
          bVal = b.group_size || 0;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'created_at':
          aVal = a.created_at || '';
          bVal = b.created_at || '';
          break;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [submissions, statusFilter, sortField, sortDirection]);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [statusFilter, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedSubmissions = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const counts = {
    new: submissions?.filter((s) => s.status === 'new').length || 0,
    contacted: submissions?.filter((s) => s.status === 'contacted').length || 0,
    booked: submissions?.filter((s) => s.status === 'booked').length || 0,
    archived: submissions?.filter((s) => s.status === 'archived').length || 0,
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteSubmission.mutateAsync(deleteTarget);
      if (selected?.id === deleteTarget) setSelected(null);
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Private Party Requests</h1>
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'new', label: 'New' },
            { value: 'contacted', label: 'Contacted' },
            { value: 'booked', label: 'Booked' },
            { value: 'archived', label: 'Archived' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40 ml-5"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(['new', 'contacted', 'booked', 'archived'] as const).map((status) => (
          <Card
            key={status}
            className="cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all"
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
          >
            <CardContent className="pt-4">
              <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{status}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No submissions found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Requests</CardTitle>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('name')}>
                      <span className="flex items-center gap-1">Name <SortIcon field="name" currentField={sortField} direction={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Contact</th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('preferred_date')}>
                      <span className="flex items-center gap-1">Date / Time <SortIcon field="preferred_date" currentField={sortField} direction={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('group_size')}>
                      <span className="flex items-center gap-1">Group Size <SortIcon field="group_size" currentField={sortField} direction={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('status')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="status" currentField={sortField} direction={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('created_at')}>
                      <span className="flex items-center gap-1">Submitted <SortIcon field="created_at" currentField={sortField} direction={sortDirection} /></span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubmissions.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <Mail className="h-3 w-3" />{s.email}
                          </span>
                          {s.phone && (
                            <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <Phone className="h-3 w-3" />{s.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {s.preferred_date || s.preferred_time ? (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {[s.preferred_date, s.preferred_time].filter(Boolean).join(' at ')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Not specified</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {s.group_size ? (
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.group_size}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusColors[s.status] || 'gray'}>{s.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(s)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Submission Details"
        className="max-w-lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.email}</p>
                {selected.phone && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.phone}</p>}
              </div>
              <Badge variant={statusColors[selected.status] || 'gray'}>{selected.status}</Badge>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preferred Date</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.preferred_date || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preferred Time</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.preferred_time || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Group Size</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.group_size || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Submitted</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatDateTime(selected.created_at)}</p>
              </div>
            </div>

            {selected.notes && (
              <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Notes</p>
                </div>
                <p className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}>{selected.notes}</p>
              </div>
            )}

            <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Update Status</label>
              <Select
                options={[
                  { value: 'new', label: 'New' },
                  { value: 'contacted', label: 'Contacted' },
                  { value: 'booked', label: 'Booked' },
                  { value: 'archived', label: 'Archived' },
                ]}
                value={selected.status}
                onChange={(e) => {
                  updateStatus.mutateAsync({ id: selected.id, status: e.target.value as SubmissionStatus });
                  setSelected({ ...selected, status: e.target.value as SubmissionStatus });
                }}
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Submission"
        message="Are you sure you want to delete this submission?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
