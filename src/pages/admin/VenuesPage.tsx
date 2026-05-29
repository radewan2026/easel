import { useState, useMemo } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useVenues, useCreateVenue, useUpdateVenue, useDeleteVenue, useTrashVenue } from '../../hooks/useEvents';
import { Plus, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import type { Venue } from '../../types/database';

type SortField = 'name' | 'city' | 'capacity' | 'is_active';
type SortDirection = 'asc' | 'desc';

function SortIndicator({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

export default function AdminVenuesPage() {
  const { data: venues, isLoading } = useVenues();
  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();
  const deleteVenue = useDeleteVenue();
  const trashVenue = useTrashVenue();
  const { showToast } = useToast();

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    phone: '',
    capacity: '',
    notes: '',
    is_active: true,
  });

  const sortedVenues = useMemo(() => {
    if (!venues) return [];
    return [...venues].sort((a, b) => {
      const aValue = sortField === 'capacity' ? (a.capacity || 0) : sortField === 'is_active' ? Number(a.is_active) : (a[sortField] || '').toString().toLowerCase();
      const bValue = sortField === 'capacity' ? (b.capacity || 0) : sortField === 'is_active' ? Number(b.is_active) : (b[sortField] || '').toString().toLowerCase();
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [venues, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const openModal = (venue?: Venue) => {
    if (venue) {
      setEditingVenue(venue);
      setFormData({
        name: venue.name,
        address_line1: venue.address_line1 || '',
        address_line2: venue.address_line2 || '',
        city: venue.city || '',
        state: venue.state || '',
        postal_code: venue.postal_code || '',
        phone: venue.phone || '',
        capacity: venue.capacity?.toString() || '',
        notes: venue.notes || '',
        is_active: venue.is_active,
      });
    } else {
      setEditingVenue(null);
      setFormData({
        name: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        phone: '',
        capacity: '',
        notes: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('Venue name is required', 'error');
      return;
    }

    try {
      const venueData = {
        name: formData.name,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        phone: formData.phone || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        notes: formData.notes || null,
        is_active: formData.is_active,
      };

      if (editingVenue) {
        await updateVenue.mutateAsync({ id: editingVenue.id, ...venueData });
      } else {
        await createVenue.mutateAsync(venueData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save venue:', err);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await trashVenue.mutateAsync(deleteTarget);
        showToast('Venue moved to trash!');
      } catch {
        try {
          await deleteVenue.mutateAsync(deleteTarget);
          showToast('Venue deleted!');
        } catch {
          showToast('Failed to delete venue', 'error');
        }
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
          <p className="text-gray-500">Manage your event venues</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Venue
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Venues</CardTitle>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { field: 'name' as const, label: 'Name' },
                { field: 'city' as const, label: 'City' },
                { field: 'capacity' as const, label: 'Capacity' },
                { field: 'is_active' as const, label: 'Status' },
              ].map((option) => (
                <button
                  key={option.field}
                  type="button"
                  onClick={() => handleSort(option.field)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  style={{
                    borderColor: sortField === option.field ? 'var(--primary-color)' : 'var(--border-color)',
                    color: sortField === option.field ? 'var(--primary-color)' : 'var(--text-secondary)',
                    backgroundColor: 'var(--card-bg)',
                  }}
                >
                  {option.label}
                  <SortIndicator field={option.field} sortField={sortField} sortDirection={sortDirection} />
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {sortedVenues.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No venues yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Create your first venue to start scheduling events.</p>
              </div>
            ) : (
            <div className="space-y-4">
              {sortedVenues.map((venue) => (
                <div
                  key={venue.id}
                  className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{venue.name}</h3>
                      {!venue.is_active && <Badge variant="danger">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {[venue.address_line1, venue.city, venue.state, venue.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {venue.phone && (
                      <p className="text-sm text-gray-500">{venue.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 mr-4">
                      {venue.capacity ? `${venue.capacity} seats` : '-'}
                    </span>
                    <Button variant="ghost" size="sm" aria-label="Edit venue" onClick={() => openModal(venue)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Delete venue" onClick={() => handleDelete(venue.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVenue ? 'Edit Venue' : 'Create Venue'}
        className="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Venue name"
            required
          />
          <Input
            label="Address Line 1"
            value={formData.address_line1}
            onChange={(e) => setFormData((prev) => ({ ...prev, address_line1: e.target.value }))}
            placeholder="123 Main Street"
            required
          />
          <Input
            label="Address Line 2"
            value={formData.address_line2}
            onChange={(e) => setFormData((prev) => ({ ...prev, address_line2: e.target.value }))}
            placeholder="Suite 100"
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="City"
              required
            />
            <Input
              label="State"
              value={formData.state}
              onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
              placeholder="State"
              required
            />
            <Input
              label="Postal Code"
              value={formData.postal_code}
              onChange={(e) => setFormData((prev) => ({ ...prev, postal_code: e.target.value }))}
              placeholder="12345"
            />
          </div>
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="(555) 123-4567"
          />
          <Input
            label="Capacity"
            type="number"
            value={formData.capacity}
            onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
            placeholder="20"
          />
          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes..."
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createVenue.isPending || updateVenue.isPending}>
              {editingVenue ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Venue"
        message="Are you sure you want to delete this venue?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
