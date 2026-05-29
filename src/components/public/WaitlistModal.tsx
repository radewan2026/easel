import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useJoinWaitlist } from '../../hooks/useWaitlist';
import { BellRing } from 'lucide-react';

export default function WaitlistModal({
  isOpen,
  onClose,
  eventId,
  eventName,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}) {
  const joinWaitlist = useJoinWaitlist();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    seats_desired: '1',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    await joinWaitlist.mutateAsync({
      event_id: eventId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      seats_desired: parseInt(formData.seats_desired) || 1,
    });

    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setFormData({ name: '', email: '', phone: '', seats_desired: '1' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Join Waitlist" className="max-w-lg">
      {submitted ? (
        <div className="text-center py-6">
          <BellRing className="h-14 w-14 text-primary-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">You're on the list!</h3>
          <p className="text-gray-600 mb-6">
            We'll notify you at <span className="font-medium">{formData.email}</span> if seats become available for <span className="font-medium">{eventName}</span>.
          </p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            This event is sold out. Join the waitlist and we'll email you if seats open up.
          </p>

          <Input
            label="Full Name *"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="Jane Smith"
            required
          />

          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            placeholder="jane@example.com"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
            <Input
              label="Seats Desired"
              type="number"
              min="1"
              max="20"
              value={formData.seats_desired}
              onChange={(e) => setFormData((p) => ({ ...p, seats_desired: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={joinWaitlist.isPending}>
              {joinWaitlist.isPending ? 'Joining...' : 'Join Waitlist'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
