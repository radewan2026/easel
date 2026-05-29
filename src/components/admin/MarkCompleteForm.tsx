import { useState } from 'react';
import { Clock, DollarSign, Save } from 'lucide-react';
import { useMarkComplete } from '../../hooks/useEventAssignments';
import { useEventAssignments } from '../../hooks/useEventAssignments';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useToast } from '../ui/Toast';
import type { EventAssignment } from '../../types/database';

interface MarkCompleteFormProps {
  assignment: EventAssignment;
  eventStart: string;
  eventEnd?: string | null;
  onClose: () => void;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function computeHours(clockIn: string, clockOut: string): number {
  const diff = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000;
  return Math.round(Math.max(diff, 0) * 4) / 4;
}

export function MarkCompleteForm({ assignment, eventStart, eventEnd, onClose }: MarkCompleteFormProps) {
  const defaultClockOut = eventEnd || new Date(new Date(eventStart).getTime() + 3 * 3600000).toISOString();

  const [clockIn, setClockIn] = useState(toDatetimeLocal(eventStart));
  const [clockOut, setClockOut] = useState(toDatetimeLocal(defaultClockOut));
  const [rate, setRate] = useState(
    String(assignment.hourly_rate_snapshot ?? assignment.employee?.hourly_rate ?? '')
  );
  const [payOverride, setPayOverride] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const markComplete = useMarkComplete();
  const { refetch } = useEventAssignments({ event_id: assignment.event_id });
  const { showToast } = useToast();

  const hours = computeHours(clockIn, clockOut);
  const rateNum = parseFloat(rate) || 0;
  const computedPay = hours * rateNum;
  const isOverridden = payOverride !== null && payOverride !== String(computedPay);

  const handleSubmit = async () => {
    if (!clockIn || !clockOut || !rate) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await markComplete.mutateAsync({
        assignmentId: assignment.id,
        clockIn: new Date(clockIn).toISOString(),
        clockOut: new Date(clockOut).toISOString(),
        notes: notes || undefined,
        hourlyRateSnapshot: parseFloat(rate),
      });
      await refetch();
      showToast('Assignment marked as complete');
      onClose();
    } catch (err: unknown) {
      showToast('Failed to mark complete: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const employeeName = assignment.employee?.name || 'Unknown Employee';
  const eventTitle = assignment.event?.title || 'Untitled Event';

  return (
    <Modal isOpen onClose={onClose} title="Mark Assignment Complete" className="max-w-lg">
      <div className="space-y-4">
        <div className="pb-3" style={{ borderBottomWidth: '1px', borderColor: 'var(--border-color)' }}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{employeeName}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{eventTitle}</p>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" style={{ color: 'var(--primary-500)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Time & Pay</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Hours</label>
                <div
                  className="w-full px-4 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {hours.toFixed(2)}
                </div>
              </div>

              <div>
                <Input
                  label="Rate ($/hr)"
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => { setRate(e.target.value); setPayOverride(null); }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  Pay
                  {isOverridden && (
                    <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(overridden)</span>
                  )}
                </label>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    step="0.01"
                    value={payOverride !== null ? payOverride : computedPay.toFixed(2)}
                    onChange={(e) => setPayOverride(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            placeholder="Any additional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={markComplete.isPending || !clockIn || !clockOut || !rate}>
            <Save className="h-4 w-4 mr-2" />
            {markComplete.isPending ? 'Saving...' : 'Confirm & Create Pay Record'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
