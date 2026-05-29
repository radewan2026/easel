import { useState, useEffect } from 'react';
import { useActiveEntry, useClockIn, useClockOut, useTimeEntries, getEntryHours, getCurrentPosition, formatLocation, getMapUrl } from '../../hooks/useTimeEntries';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../lib/utils';
import { Clock, Timer, LogIn, LogOut } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

export default function TimeClockPage() {
  const { user } = useAuth();
  const { data: activeEntry, isLoading: activeLoading } = useActiveEntry(user?.id);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { showToast } = useToast();
  const [notes, setNotes] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: recentEntries, isLoading: entriesLoading } = useTimeEntries({
    accountId: user?.id,
  });

  const allEntries = recentEntries || [];
  const totalPages = Math.max(1, Math.ceil(allEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedEntries = allEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!activeEntry?.clock_in) {
      queueMicrotask(() => setElapsed(''));
      return;
    }
    const update = () => {
      const start = new Date(activeEntry.clock_in).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h}h ${m}m ${s}s`);
    };
    queueMicrotask(update);
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.clock_in]);

  const handleClockIn = async () => {
    if (!user?.id) return;
    try {
      const pos = await getCurrentPosition();
      await clockIn.mutateAsync({
        accountId: user.id,
        notes: notes || undefined,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      });
      setNotes('');
    } catch (err: unknown) {
      showToast('Failed to clock in: ' + getErrorMessage(err), 'error');
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    try {
      await clockOut.mutateAsync({ id: activeEntry.id, notes: notes || undefined });
      setNotes('');
    } catch (err: unknown) {
      showToast('Failed to clock out: ' + getErrorMessage(err), 'error');
    }
  };

  if (activeLoading) return <LoadingSpinner />;

  const hourlyRate = activeEntry?.account?.hourly_rate;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Time Clock</h1>
          <p style={{ color: 'var(--text-muted)' }}>Clock in and out to track your hours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="py-8 flex flex-col items-center justify-center">
            {activeEntry ? (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#22c55e20' }}>
                  <Timer className="h-10 w-10" style={{ color: '#22c55e' }} />
                </div>
                <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Currently Clocked In</p>
                <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                  Since {formatDateTime(activeEntry.clock_in)}
                </p>
                <p className="text-2xl font-bold mb-4" style={{ color: '#22c55e' }}>{elapsed}</p>
                {activeEntry.latitude != null && activeEntry.longitude != null && (
                  <a
                    href={getMapUrl(activeEntry) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs mb-3 inline-flex items-center gap-1 underline"
                    style={{ color: 'var(--primary-color)' }}
                  >
                    📍 {formatLocation(activeEntry)}
                  </a>
                )}
                {hourlyRate != null && (
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Earning {formatCurrency(hourlyRate)}/hr
                  </p>
                )}
                <div className="w-full max-w-sm mb-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    rows={2}
                  />
                </div>
                <Button
                  className="bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleClockOut}
                  disabled={clockOut.isPending}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Clock Out
                </Button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--primary-color)', opacity: 0.15 }}>
                  <Clock className="h-10 w-10" style={{ color: 'var(--primary-color)' }} />
                </div>
                <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Ready to Clock In</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  You are not currently clocked in
                </p>
                {hourlyRate != null && (
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Rate: {formatCurrency(hourlyRate)}/hr
                  </p>
                )}
                <div className="w-full max-w-sm mb-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    rows={2}
                  />
                </div>
                <Button onClick={handleClockIn} disabled={clockIn.isPending}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Clock In
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const todayEntries = allEntries.filter((e) => e.clock_in.startsWith(today));
              const todayHours = todayEntries.reduce((sum, e) => sum + getEntryHours(e), 0);
              const weekStart = new Date();
              weekStart.setDate(weekStart.getDate() - weekStart.getDay());
              weekStart.setHours(0, 0, 0, 0);
              const weekEntries = allEntries.filter((e) => new Date(e.clock_in) >= weekStart);
              const weekHours = weekEntries.reduce((sum, e) => sum + getEntryHours(e), 0);

              return (
                <>
                  <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Today</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{todayHours.toFixed(2)} hrs</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>This Week</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{weekHours.toFixed(2)} hrs</span>
                  </div>
                  {hourlyRate != null && (
                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Est. Week Earnings</span>
                      <span className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>{formatCurrency(weekHours * hourlyRate)}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Entries</CardTitle>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={allEntries.length} pageSize={pageSize} onPageChange={setPage} position="top" />
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <LoadingSpinner />
          ) : paginatedEntries.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <Clock className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              No time entries yet. Clock in to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Clock In</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Clock Out</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Hours</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Location</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((entry) => {
                    const hours = getEntryHours(entry);
                    return (
                      <tr key={entry.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                          {new Date(entry.clock_in).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {entry.clock_out
                            ? new Date(entry.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {entry.clock_out ? hours.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {entry.latitude != null && entry.longitude != null ? (
                            <a
                              href={getMapUrl(entry) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                              style={{ color: 'var(--primary-color)' }}
                            >
                              📍 {formatLocation(entry)}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {entry.clock_out ? (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>Complete</span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>Active</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                          {entry.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {allEntries.length > pageSize && (
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={allEntries.length} pageSize={pageSize} onPageChange={setPage} position="bottom" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
