import { useState, useMemo, useEffect } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useWaitlist, useUpdateWaitlistEntry, useDeleteWaitlistEntry } from '../../hooks/useWaitlist';
import { formatDateTime } from '../../lib/utils';
import { Bell, Trash2, Eye, Mail, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import type { WaitlistEntry } from '../../types/database';

type SortField = 'name' | 'email' | 'seats_desired' | 'notified' | 'created_at';
type SortDirection = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
}

export default function WaitlistPage() {
  const { data: entries, isLoading } = useWaitlist();
  const updateEntry = useUpdateWaitlistEntry();
  const deleteEntry = useDeleteWaitlistEntry();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<WaitlistEntry | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => {
      let aVal = a[sortField as keyof WaitlistEntry];
      let bVal = b[sortField as keyof WaitlistEntry];
      if (sortField === 'notified') {
        aVal = a.notified ? 1 : 0;
        bVal = b.notified ? 1 : 0;
      }
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [entries, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedEntries.length / pageSize);
  const paginatedEntries = sortedEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteEntry.mutateAsync(deleteTarget);
        showToast('Entry deleted', 'success');
      } catch (err) {
        showToast('Failed to delete entry: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const pendingCount = entries?.filter(e => !e.notified).length || 0;
  const notifiedCount = entries?.filter(e => e.notified).length || 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Waitlist</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage event waitlist entries</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Notified</p>
            <p className="text-2xl font-bold text-green-600">{notifiedCount}</p>
          </CardContent>
        </Card>
      </div>

      {!entries || entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No waitlist entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Waitlist Entries</CardTitle>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedEntries.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              position="top"
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('name')}>
                      <span className="flex items-center gap-1">Name <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('email')}>
                      <span className="flex items-center gap-1">Email <SortIcon field="email" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Event</th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('seats_desired')}>
                      <span className="flex items-center gap-1">Seats <SortIcon field="seats_desired" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('notified')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="notified" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('created_at')}>
                      <span className="flex items-center gap-1">Joined <SortIcon field="created_at" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((entry) => (
                    <tr key={entry.id} style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{entry.name}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />{entry.email}
                        </span>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{entry.event?.title || '-'}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{entry.seats_desired}</td>
                      <td className="py-3 px-4">
                        {entry.notified ? (
                          <Badge variant="success">Notified</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{formatDateTime(entry.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        {!entry.notified && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Mark as notified"
                            onClick={async () => {
                              try {
                                await updateEntry.mutateAsync({ id: entry.id, notified: true });
                                showToast('Marked as notified', 'success');
                              } catch (err) {
                                showToast('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
                              }
                            }}
                          >
                            <Check className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setSelected(entry)}>
                          <Eye className="h-4 w-4" />
                        </Button>
<Button variant="ghost" size="sm" onClick={() => {
                            setDeleteTarget(entry.id);
                            setShowDeleteConfirm(true);
                          }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedEntries.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              position="bottom"
            />
          </CardContent>
        </Card>
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Waitlist Entry" className="max-w-lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.email}</p>
                {selected.phone && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.phone}</p>}
              </div>
              <Badge variant={selected.notified ? 'success' : 'warning'}>
                {selected.notified ? 'Notified' : 'Pending'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderColor: 'var(--border-color)', borderTopWidth: '1px' }}>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Event</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.event?.title || '-'}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Seats Desired</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.seats_desired}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Joined</p>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{formatDateTime(selected.created_at)}</p>
              </div>
            </div>
            {!selected.notified && (
              <div className="pt-4" style={{ borderColor: 'var(--border-color)', borderTopWidth: '1px' }}>
                <Button
                  onClick={async () => {
                    try {
                      await updateEntry.mutateAsync({ id: selected.id, notified: true });
                      showToast('Marked as notified', 'success');
                      setSelected({ ...selected, notified: true });
                    } catch (err) {
                      showToast('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
                    }
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark as Notified
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this waitlist entry?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
