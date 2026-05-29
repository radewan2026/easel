import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Users, UserPlus, Filter } from 'lucide-react';
import { useEventAssignments, useAssignEmployee } from '../../hooks/useEventAssignments';
import { useEvents } from '../../hooks/useEvents';
import { useEmployees } from '../../hooks/useEmployees';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import type { Event, EventAssignment } from '../../types/database';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'confirmed', label: 'Confirmed' },
];

function formatDateRange(days: number): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return { from, to };
}

function getStaffingStatus(assignments: EventAssignment[]): 'unassigned' | 'assigned' | 'confirmed' {
  if (assignments.length === 0) return 'unassigned';
  if (assignments.every(a => a.status === 'confirmed')) return 'confirmed';
  return 'assigned';
}

type StaffingBadgeProps = { status: 'unassigned' | 'assigned' | 'confirmed' };

function StaffingBadge({ status }: StaffingBadgeProps) {
  switch (status) {
    case 'unassigned':
      return <Badge variant="gray">Unassigned</Badge>;
    case 'assigned':
      return <Badge variant="warning">Assigned</Badge>;
    case 'confirmed':
      return <Badge variant="success">Confirmed</Badge>;
  }
}

function computeEmployeeWorkloads(assignments: EventAssignment[]) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const workloads: Record<string, { weekHours: number; monthHours: number }> = {};

  for (const a of assignments) {
    if (a.status === 'declined') continue;
    const assignedDate = new Date(a.assigned_at);
    const hours = Number(a.hours_worked) || 0;

    if (!workloads[a.employee_id]) {
      workloads[a.employee_id] = { weekHours: 0, monthHours: 0 };
    }

    if (assignedDate >= weekStart) {
      workloads[a.employee_id].weekHours += hours;
    }
    if (assignedDate >= monthStart) {
      workloads[a.employee_id].monthHours += hours;
    }
  }

  return workloads;
}

function formatWorkload(workloads: Record<string, { weekHours: number; monthHours: number }>, employeeId: string): string {
  const w = workloads[employeeId];
  if (!w) return '0 hrs this week / 0 hrs this month';
  return `${w.weekHours} hrs this week / ${w.monthHours} hrs this month`;
}

export default function AssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [daysAhead, setDaysAhead] = useState(7);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [assignModalEventId, setAssignModalEventId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const pageSize = 10;

  const { data: allEvents, isLoading: eventsLoading } = useEvents();
  const { data: allAssignments, isLoading: assignmentsLoading } = useEventAssignments();
  const { data: employees, isLoading: employeesLoading } = useEmployees({ status: 'active' });
  const assignEmployee = useAssignEmployee();
  const directAssignEventId = searchParams.get('eventId');
  const directAssignAction = searchParams.get('action');

  const { from, to } = formatDateRange(daysAhead);

  const upcomingEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents.filter((e: Event) => {
      const start = new Date(e.start_datetime);
      return start >= from && start <= to && !e.is_archived;
    });
  }, [allEvents, from, to]);

  const assignmentsByEvent = useMemo(() => {
    const map: Record<string, EventAssignment[]> = {};
    if (!allAssignments) return map;
    for (const a of allAssignments) {
      if (!map[a.event_id]) map[a.event_id] = [];
      map[a.event_id].push(a);
    }
    return map;
  }, [allAssignments]);

  const employeeMap = useMemo(() => {
    const map: Record<string, { name: string; role: string }> = {};
    if (!employees) return map;
    for (const e of employees) {
      map[e.id] = { name: e.name, role: e.role };
    }
    return map;
  }, [employees]);

  const workloads = useMemo(() => computeEmployeeWorkloads(allAssignments || []), [allAssignments]);

  const rows = useMemo(() => {
    return upcomingEvents.map((event: Event) => {
      const eventAssignments = assignmentsByEvent[event.id] || [];
      const staffing = getStaffingStatus(eventAssignments);
      return { event, assignments: eventAssignments, staffing };
    });
  }, [upcomingEvents, assignmentsByEvent]);

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter(r => r.staffing === statusFilter);
  }, [rows, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const isAssigning = assignEmployee.isPending;

  useEffect(() => {
    if (eventsLoading || !allEvents || directAssignAction !== 'assign' || !directAssignEventId) return;

    const targetEvent = allEvents.find((event: Event) => event.id === directAssignEventId);
    queueMicrotask(() => {
      if (targetEvent) {
        const daysUntil = Math.ceil((new Date(targetEvent.start_datetime).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntil > daysAhead) {
          setDaysAhead(daysUntil <= 14 ? 14 : 30);
        }
      }

      setStatusFilter('');
      setAssignModalEventId(directAssignEventId);
      setSelectedEmployeeId('');
    });
  }, [eventsLoading, allEvents, directAssignAction, directAssignEventId, daysAhead]);

  const handleAssign = () => {
    if (!assignModalEventId || !selectedEmployeeId) return;
    assignEmployee.mutate(
      { event_id: assignModalEventId, employee_id: selectedEmployeeId },
      {
        onSuccess: () => {
          setAssignModalEventId(null);
          setSelectedEmployeeId('');
        },
      }
    );
  };

  if (eventsLoading || assignmentsLoading || employeesLoading) return <LoadingSpinner />;

  const modalEvent = allEvents?.find((e: Event) => e.id === assignModalEventId);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Assignments Board</h1>
          <p style={{ color: 'var(--text-muted)' }}>Cross-event staffing overview for upcoming events</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              Upcoming Events
            </span>
          </CardTitle>
          <Pagination currentPage={currentPageSafe} totalPages={totalPages} totalItems={filteredRows.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <select
                value={daysAhead}
                onChange={(e) => { setDaysAhead(Number(e.target.value)); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--admin-input-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value={3}>Next 3 days</option>
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Event Name</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Venue</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Seats</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Assigned Employees</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Staffing Status</th>
                  <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No events found in this date range
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map(({ event, assignments, staffing }) => (
                    <tr key={event.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4">
                        <Link
                          to={`/admin/events/${event.id}`}
                          className="font-medium hover:underline"
                          style={{ color: 'var(--primary-color)' }}
                        >
                          {event.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(event.start_datetime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {event.venue?.name || '—'}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {event.seats_available ?? '—'}/{event.max_seats ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        {assignments.length === 0 ? (
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No staff assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignments.map((a) => {
                              const emp = employeeMap[a.employee_id];
                              return (
                                <span
                                  key={a.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                  title={emp ? formatWorkload(workloads, a.employee_id) : ''}
                                >
                                  {emp?.name || 'Unknown'}
                                  {a.status === 'confirmed' && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StaffingBadge status={staffing} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAssignModalEventId(event.id);
                            setSelectedEmployeeId('');
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPageSafe} totalPages={totalPages} totalItems={filteredRows.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
        </CardContent>
      </Card>

      <Modal
        isOpen={!!assignModalEventId}
        onClose={() => {
          setAssignModalEventId(null);
          setSelectedEmployeeId('');
          if (directAssignAction === 'assign') setSearchParams({});
        }}
        title={`Assign Employee — ${modalEvent?.title || ''}`}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="assign-employee" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Select Employee
            </label>
            <select
              id="assign-employee"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Choose an employee...</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.role}
                </option>
              ))}
            </select>
          </div>

          {selectedEmployeeId && workloads[selectedEmployeeId] && (
            <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              Current workload: {formatWorkload(workloads, selectedEmployeeId)}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setAssignModalEventId(null);
              setSelectedEmployeeId('');
              if (directAssignAction === 'assign') setSearchParams({});
            }}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedEmployeeId || isAssigning}>
              {isAssigning ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
