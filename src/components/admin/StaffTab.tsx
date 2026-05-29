import { useState } from 'react';
import { UserPlus, X, DollarSign } from 'lucide-react';
import { useEventAssignments, useUnassignEmployee, useConfirmAssignment, useMarkComplete } from '../../hooks/useEventAssignments';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { formatCurrency } from '../../lib/utils';
import { AssignmentDrawer } from './AssignmentDrawer';
import type { AssignmentStatus } from '../../types/database';

interface StaffTabProps {
  eventId: string;
}

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; variant: 'warning' | 'success' | 'danger' | 'primary' }> = {
  assigned: { label: 'Assigned', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  declined: { label: 'Declined', variant: 'danger' },
  completed: { label: 'Completed', variant: 'primary' },
};

export function StaffTab({ eventId }: StaffTabProps) {
  const { data: assignments, isLoading } = useEventAssignments({ event_id: eventId });
  const unassignEmployee = useUnassignEmployee();
  const confirmAssignment = useConfirmAssignment();
  const markComplete = useMarkComplete();
  const { showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState<string | null>(null);
  const [markCompleteModal, setMarkCompleteModal] = useState<string | null>(null);

  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  const eventStart = assignments?.[0]?.event?.start_datetime;
  const isPastEvent = eventStart ? new Date(eventStart) < new Date() : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary-500)' }} />
      </div>
    );
  }

  const handleUnassign = async (assignmentId: string) => {
    try {
      await unassignEmployee.mutateAsync(assignmentId);
      showToast('Employee unassigned successfully');
      setConfirmUnassign(null);
    } catch (err: unknown) {
      showToast('Failed to unassign: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleConfirm = async (assignmentId: string) => {
    try {
      await confirmAssignment.mutateAsync(assignmentId);
      showToast('Assignment confirmed');
    } catch (err: unknown) {
      showToast('Failed to confirm: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleMarkComplete = async () => {
    if (!markCompleteModal || !clockIn || !clockOut || !hourlyRate) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await markComplete.mutateAsync({
        assignmentId: markCompleteModal,
        clockIn,
        clockOut,
        notes: completeNotes || undefined,
        hourlyRateSnapshot: parseFloat(hourlyRate),
      });
      showToast('Assignment marked as complete');
      setMarkCompleteModal(null);
      setClockIn('');
      setClockOut('');
      setCompleteNotes('');
      setHourlyRate('');
    } catch (err: unknown) {
      showToast('Failed to mark complete: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const activeAssignments = assignments?.filter(a => a.status !== 'declined') || [];
  const assignmentToComplete = markCompleteModal ? assignments?.find(a => a.id === markCompleteModal) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Staff Assignments ({activeAssignments.length})
        </h3>
        <Button size="sm" onClick={() => setDrawerOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Assign Employee
        </Button>
      </div>

      {activeAssignments.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No staff assigned to this event yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeAssignments.map((assignment) => {
            const config = STATUS_CONFIG[assignment.status];
            return (
              <Card key={assignment.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                      >
                        {assignment.employee?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {assignment.employee?.name || 'Unknown'}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {assignment.employee?.role || 'No role'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={config.variant}>{config.label}</Badge>

                      {assignment.status === 'completed' && assignment.pay_amount != null && (
                        <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatCurrency(assignment.pay_amount)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderColor: 'var(--border-color)', borderTopWidth: '1px' }}>
                    {assignment.status === 'assigned' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleConfirm(assignment.id)} disabled={confirmAssignment.isPending}>
                          Confirm
                        </Button>
                        {isPastEvent && (
                          <Button size="sm" variant="ghost" onClick={() => {
                            setHourlyRate(assignment.employee?.hourly_rate?.toString() || '');
                            setMarkCompleteModal(assignment.id);
                          }}>
                            Mark Complete
                          </Button>
                        )}
                      </>
                    )}
                    {assignment.status === 'confirmed' && isPastEvent && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        setHourlyRate(assignment.employee?.hourly_rate?.toString() || '');
                        setMarkCompleteModal(assignment.id);
                      }}>
                        Mark Complete
                      </Button>
                    )}
                    {confirmUnassign === assignment.id ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Unassign?</span>
                        <Button size="sm" variant="danger" onClick={() => handleUnassign(assignment.id)} disabled={unassignEmployee.isPending}>
                          Yes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmUnassign(null)}>No</Button>
                      </div>
                    ) : (
                      <button
                        className="ml-auto text-sm hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => setConfirmUnassign(assignment.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AssignmentDrawer
        eventId={eventId}
        date={eventStart || ''}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <Modal isOpen={!!markCompleteModal} onClose={() => setMarkCompleteModal(null)} title="Mark Assignment Complete" className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Mark <strong>{assignmentToComplete?.employee?.name}</strong> as completed for this event.
          </p>

          <Input
            label="Clock In"
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
          />

          <Input
            label="Clock Out"
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
          />

          <Input
            label="Hourly Rate ($)"
            type="number"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Notes (optional)
            </label>
            <textarea
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setMarkCompleteModal(null)}>Cancel</Button>
            <Button onClick={handleMarkComplete} disabled={markComplete.isPending || !clockIn || !clockOut || !hourlyRate}>
              {markComplete.isPending ? 'Saving...' : 'Mark Complete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
