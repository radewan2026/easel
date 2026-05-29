import { useState } from 'react';
import { Search, Clock, DollarSign, X } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { useEventAssignments, useAssignEmployee } from '../../hooks/useEventAssignments';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { formatCurrency } from '../../lib/utils';

interface AssignmentDrawerProps {
  eventId: string;
  date: string;
  onClose: () => void;
  open: boolean;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getEventDayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return DAY_NAMES[date.getDay()];
}

export function AssignmentDrawer({ eventId, date, onClose, open }: AssignmentDrawerProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const { data: employees, isLoading: employeesLoading } = useEmployees({ status: 'active' });
  const { data: existingAssignments } = useEventAssignments({ event_id: eventId });
  const assignEmployee = useAssignEmployee();
  const { showToast } = useToast();

  const eventDay = getEventDayOfWeek(date);

  const filteredEmployees = (employees || []).filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.email.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q);
  });

  const alreadyAssignedIds = new Set((existingAssignments || []).map((a) => a.employee_id));

  const allAssignments = useEventAssignments({});

  const getAvailabilityInfo = (employeeId: string): { available: boolean; hasConflict: boolean } => {
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp) return { available: false, hasConflict: false };

    const availableOnDay = !emp.availability_days || emp.availability_days.length === 0 || emp.availability_days.includes(eventDay);
    const assignmentsOnDay = (allAssignments.data || []).filter(
      (a) => a.employee_id === employeeId && a.event?.start_datetime && getEventDayOfWeek(a.event.start_datetime) === eventDay && a.status !== 'declined'
    );
    const hasConflict = assignmentsOnDay.length > 0;

    return { available: availableOnDay, hasConflict };
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selected).map((employeeId) =>
          assignEmployee.mutateAsync({ event_id: eventId, employee_id: employeeId })
        )
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        showToast(`${selected.size - failures.length} assigned, ${failures.length} failed`, 'error');
      } else {
        showToast(`${selected.size} employee(s) assigned successfully`);
      }
      setSelected(new Set());
      onClose();
    } catch {
      showToast('Failed to assign employees', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto shadow-xl"
        style={{ backgroundColor: 'var(--card-bg)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Assign Employees
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              style={{ backgroundColor: 'var(--input-bg, var(--section-bg-light))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          {date && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Clock className="h-4 w-4" />
              <span>Event day: <strong className="capitalize">{eventDay || 'Unknown'}</strong></span>
            </div>
          )}

          {employeesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary-500)' }} />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              No employees found.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map((employee) => {
                const isAssigned = alreadyAssignedIds.has(employee.id);
                const { available, hasConflict } = getAvailabilityInfo(employee.id);
                const isSelected = selected.has(employee.id);

                let dotColor = 'bg-green-500';
                if (!available) dotColor = 'bg-red-500';
                else if (hasConflict) dotColor = 'bg-yellow-500';

                return (
                  <div
                    key={employee.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isAssigned ? 'opacity-50 cursor-not-allowed' : isSelected ? 'ring-2 ring-primary-500' : ''
                    }`}
                    style={{ borderColor: 'var(--border-color)', backgroundColor: isSelected ? 'var(--section-bg-light)' : 'transparent' }}
                    onClick={() => !isAssigned && toggleSelect(employee.id)}
                  >
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <div className="h-5 w-5 rounded border-2 flex items-center justify-center bg-primary-500 border-primary-500">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded border-2" style={{ borderColor: 'var(--border-color)' }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {employee.name}
                        </span>
                        {isAssigned && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            (already assigned)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={employee.role === 'instructor' ? 'primary' : employee.role === 'artist' ? 'success' : 'gray'}>
                          {employee.role}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(employee.hourly_rate)}/hr
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: undefined }}>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selected.size > 0 && (
            <div
              className="sticky bottom-0 -mx-6 px-6 py-4 border-t flex items-center justify-between"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {selected.size} employee{selected.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}