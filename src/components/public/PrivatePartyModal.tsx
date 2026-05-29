import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCreateSubmission } from '../../hooks/useSubmissions';
import { PartyPopper } from 'lucide-react';

export default function PrivatePartyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const createSubmission = useCreateSubmission();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    preferred_date: '',
    preferred_time: '',
    group_size: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    await createSubmission.mutateAsync({
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      event_type: 'private_party',
      preferred_date: formData.preferred_date || undefined,
      preferred_time: formData.preferred_time || undefined,
      group_size: formData.group_size ? parseInt(formData.group_size) : undefined,
      notes: formData.notes || undefined,
    });

    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      preferred_date: '',
      preferred_time: '',
      group_size: '',
      notes: '',
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request a Private Party" className="max-w-lg">
      {submitted ? (
        <div className="text-center py-6">
          <PartyPopper className="h-14 w-14 text-primary-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Request Received!</h3>
          <p className="text-gray-600 mb-6">
            Thanks, {formData.name}! We'll get back to you at <span className="font-medium">{formData.email}</span> within 24 hours.
          </p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Fill out the form below and our team will reach out to plan your perfect private painting party.
          </p>

          <Input
            label="Full Name *"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="Jane Smith"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              placeholder="jane@example.com"
              required
            />
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Preferred Date"
              type="date"
              value={formData.preferred_date}
              onChange={(e) => setFormData((p) => ({ ...p, preferred_date: e.target.value }))}
            />
            <Input
              label="Preferred Time"
              type="time"
              value={formData.preferred_time}
              onChange={(e) => setFormData((p) => ({ ...p, preferred_time: e.target.value }))}
            />
            <Input
              label="Group Size"
              type="number"
              min="1"
              value={formData.group_size}
              onChange={(e) => setFormData((p) => ({ ...p, group_size: e.target.value }))}
              placeholder="10"
            />
          </div>

          <Textarea
            label="Notes / Special Requests"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Birthday celebration, team building, etc."
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSubmission.isPending}>
              {createSubmission.isPending ? 'Sending...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
