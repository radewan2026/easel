import { useState } from 'react';
import { useRescheduleEvent } from '../../hooks/useEvents';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertTriangle, Calendar, Mail } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';
import type { Event } from '../../types/database';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
}

export default function RescheduleModal({ isOpen, onClose, event }: RescheduleModalProps) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [notifyAttendees, setNotifyAttendees] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const reschedule = useRescheduleEvent();
  const { showToast } = useToast();

  const currentStart = event.start_datetime ? new Date(event.start_datetime) : null;
  const currentDuration = event.end_datetime
    ? new Date(event.end_datetime).getTime() - new Date(event.start_datetime).getTime()
    : 0;

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      showToast('Please select a new date and time');
      return;
    }

    const newStartDatetime = new Date(`${newDate}T${newTime}`);
    const newEndDatetime = currentDuration
      ? new Date(newStartDatetime.getTime() + currentDuration)
      : null;

    try {
      await reschedule.mutateAsync({
        eventId: event.id,
        oldStartDatetime: event.start_datetime,
        newStartDatetime: newStartDatetime.toISOString(),
        newEndDatetime: newEndDatetime?.toISOString() || null,
        notifyAttendees,
        customMessage,
        eventTitle: event.title,
      });
      showToast('Event rescheduled successfully');
      onClose();
    } catch (err: unknown) {
      showToast('Failed to reschedule: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const previewDatetime = newDate && newTime
    ? new Date(`${newDate}T${newTime}`)
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Event" className="max-w-lg">
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Current Schedule</p>
              <p className="text-sm text-blue-700">
                {currentStart ? formatDateTime(currentStart) : 'Not set'}
              </p>
              {event.end_datetime && (
                <p className="text-xs text-blue-600 mt-1">
                  Ends: {formatDateTime(event.end_datetime)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {previewDatetime && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800">New Schedule</p>
            <p className="text-sm text-green-700">{formatDateTime(previewDatetime)}</p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                All booked attendees will need to be notified of the schedule change.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={notifyAttendees}
              onChange={(e) => setNotifyAttendees(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Send reschedule notification email to all booked attendees
            </span>
          </label>

          {notifyAttendees && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom message (optional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a personal note about the schedule change..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleReschedule}
            disabled={reschedule.isPending || !newDate || !newTime}
          >
            {reschedule.isPending ? 'Rescheduling...' : 'Reschedule Event'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
