import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useTestimonials,
  useCreateTestimonial,
  useUpdateTestimonial,
  useTrashTestimonial,
} from '../../hooks/useTestimonials';
import { useEvents } from '../../hooks/useEvents';
import { formatDate } from '../../lib/utils';
import { Plus, Edit2, Trash2, Star, StarOff, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import type { Testimonial } from '../../hooks/useTestimonials';

export default function AdminTestimonialsPage() {
  const { data: testimonials, isLoading } = useTestimonials();
  const { data: events } = useEvents();
  const createTestimonial = useCreateTestimonial();
  const updateTestimonial = useUpdateTestimonial();
  const trashTestimonial = useTrashTestimonial();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    author_name: '',
    author_email: '',
    author_image_url: '',
    content: '',
    rating: 5,
    event_id: '',
    is_published: false,
    is_featured: false,
  });

  const openModal = (testimonial?: Testimonial) => {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setFormData({
        author_name: testimonial.author_name,
        author_email: testimonial.author_email || '',
        author_image_url: testimonial.author_image_url || '',
        content: testimonial.content,
        rating: testimonial.rating,
        event_id: testimonial.event_id || '',
        is_published: testimonial.is_published,
        is_featured: testimonial.is_featured,
      });
    } else {
      setEditingTestimonial(null);
      setFormData({
        author_name: '',
        author_email: '',
        author_image_url: '',
        content: '',
        rating: 5,
        event_id: '',
        is_published: false,
        is_featured: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.author_name.trim() || !formData.content.trim()) {
      showToast('Name and content are required', 'error');
      return;
    }

    try {
      const data = {
        author_name: formData.author_name,
        author_email: formData.author_email || null,
        author_image_url: formData.author_image_url || null,
        content: formData.content,
        rating: formData.rating,
        event_id: formData.event_id || null,
        is_published: formData.is_published,
        is_featured: formData.is_featured,
      };

      if (editingTestimonial) {
        await updateTestimonial.mutateAsync({ id: editingTestimonial.id, ...data });
        showToast('Testimonial updated!');
      } else {
        await createTestimonial.mutateAsync(data);
        showToast('Testimonial created!');
      }
      setIsModalOpen(false);
    } catch {
      showToast('Failed to save testimonial', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await trashTestimonial.mutateAsync(deleteTarget);
        showToast('Testimonial moved to trash!');
      } catch {
        showToast('Failed to delete testimonial', 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const togglePublished = async (testimonial: Testimonial) => {
    try {
      await updateTestimonial.mutateAsync({
        id: testimonial.id,
        is_published: !testimonial.is_published,
      });
      showToast('Testimonial status updated!');
    } catch {
      showToast('Failed to update testimonial', 'error');
    }
  };

  const toggleFeatured = async (testimonial: Testimonial) => {
    try {
      await updateTestimonial.mutateAsync({
        id: testimonial.id,
        is_featured: !testimonial.is_featured,
      });
      showToast('Featured status updated!');
    } catch {
      showToast('Failed to update testimonial', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const testimonialList = testimonials || [];
  const totalPages = Math.ceil(testimonialList.length / pageSize);
  const paginatedItems = testimonialList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testimonials</h1>
          <p className="text-gray-500">Manage customer reviews and testimonials</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Testimonial
        </Button>
      </div>

      {testimonialList.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={testimonialList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          position="top"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedItems.map((testimonial) => (
          <Card key={testimonial.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {testimonial.author_image_url ? (
                    <img
                      src={testimonial.author_image_url}
                      alt={testimonial.author_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium text-sm">
                        {testimonial.author_name.charAt(0)}
                      </span>
                    </div>
                  )}
    <div className="w-full">
                    <h3 className="font-medium text-gray-900">{testimonial.author_name}</h3>
                    {testimonial.author_email && (
                      <p className="text-xs text-gray-500">{testimonial.author_email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleFeatured(testimonial)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={testimonial.is_featured ? 'Remove from featured' : 'Mark as featured'}
                  >
                    {testimonial.is_featured ? (
                      <Star className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <StarOff className="h-4 w-4 text-gray-300" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                    }`}
                  />
                ))}
              </div>

              <p className="text-gray-600 text-sm mb-3 line-clamp-3">{testimonial.content}</p>

              {testimonial.event && (
                <Badge variant="primary" className="mb-3">
                  {testimonial.event.title}
                </Badge>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Badge variant={testimonial.is_published ? 'success' : 'gray'}>
                    {testimonial.is_published ? 'Published' : 'Draft'}
                  </Badge>
                  {testimonial.is_featured && (
                    <Badge variant="warning">Featured</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" aria-label={testimonial.is_published ? 'Unpublish testimonial' : 'Publish testimonial'} onClick={() => togglePublished(testimonial)}>
                    {testimonial.is_published ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Edit testimonial" onClick={() => openModal(testimonial)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Delete testimonial" onClick={() => handleDelete(testimonial.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-2">{formatDate(testimonial.created_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {testimonialList.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={testimonialList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}

      {testimonialList.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No testimonials yet. Add your first one!</p>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}
        className="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Author Name"
            value={formData.author_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, author_name: e.target.value }))}
            placeholder="John Doe"
            required
          />
          <Input
            label="Author Email"
            type="email"
            value={formData.author_email}
            onChange={(e) => setFormData((prev) => ({ ...prev, author_email: e.target.value }))}
            placeholder="john@example.com"
          />
          <Input
            label="Author Image URL"
            value={formData.author_image_url}
            onChange={(e) => setFormData((prev) => ({ ...prev, author_image_url: e.target.value }))}
            placeholder="https://example.com/photo.jpg"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, rating: star }))}
                  className="p-1"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= formData.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Testimonial"
            value={formData.content}
            onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="What did they say about their experience?"
            rows={4}
            required
          />
          <Select
            label="Event (optional)"
            options={[
              { value: '', label: 'No event' },
              ...(events?.map((e) => ({ value: e.id, label: e.title })) || []),
            ]}
            value={formData.event_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, event_id: e.target.value }))}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_published"
                checked={formData.is_published}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_published: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_published" className="text-sm text-gray-700">Published</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_featured"
                checked={formData.is_featured}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_featured: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_featured" className="text-sm text-gray-700">Featured</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTestimonial.isPending || updateTestimonial.isPending}
            >
              {editingTestimonial ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Move to Trash"
        message="Are you sure you want to move this testimonial to trash?"
        confirmLabel="Move to Trash"
        variant="warning"
        icon="warning"
      />
    </div>
  );
}
