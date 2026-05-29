import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useFAQs,
  useCreateFAQ,
  useUpdateFAQ,
  useTrashFAQ,
  type FAQ,
} from '../../hooks/useFAQs';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

const CATEGORIES = ['General', 'Booking', 'Pricing', 'Events', 'Cancellations', 'Venues'];

export default function AdminFAQsPage() {
  const { data: faqs, isLoading } = useFAQs();
  const createFAQ = useCreateFAQ();
  const updateFAQ = useUpdateFAQ();
  const trashFAQ = useTrashFAQ();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General',
    sort_order: '0',
    is_published: true,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const openModal = (faq?: FAQ) => {
    if (faq) {
      setEditingFAQ(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        sort_order: faq.sort_order.toString(),
        is_published: faq.is_published,
      });
    } else {
      setEditingFAQ(null);
      setFormData({
        question: '',
        answer: '',
        category: 'General',
        sort_order: '0',
        is_published: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      showToast('Question and answer are required', 'error');
      return;
    }

    try {
      const data = {
        question: formData.question,
        answer: formData.answer,
        category: formData.category,
        sort_order: parseInt(formData.sort_order) || 0,
        is_published: formData.is_published,
      };

      if (editingFAQ) {
        await updateFAQ.mutateAsync({ id: editingFAQ.id, ...data });
        showToast('FAQ updated!');
      } else {
        await createFAQ.mutateAsync(data);
        showToast('FAQ created!');
      }
      setIsModalOpen(false);
    } catch {
      showToast('Failed to save FAQ', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await trashFAQ.mutateAsync(deleteTarget);
        showToast('FAQ moved to trash!');
      } catch {
        showToast('Failed to delete FAQ', 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const togglePublished = async (faq: FAQ) => {
    try {
      await updateFAQ.mutateAsync({ id: faq.id, is_published: !faq.is_published });
      showToast('FAQ status updated!');
    } catch {
      showToast('Failed to update FAQ', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const groupedFAQs = faqs?.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQ[]>);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQs</h1>
          <p className="text-gray-500">Manage frequently asked questions</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ
        </Button>
      </div>

      {Object.entries(groupedFAQs || {}).map(([category, categoryFAQs]) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Badge variant="primary">{category}</Badge>
            <span className="text-sm text-gray-500 font-normal">({categoryFAQs.length})</span>
          </h2>
          <div className="space-y-3">
            {categoryFAQs.map((faq) => (
              <Card key={faq.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{faq.question}</h3>
                        <Badge variant={faq.is_published ? 'success' : 'gray'} className="flex-shrink-0 text-xs">
                          {faq.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePublished(faq); }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title={faq.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {faq.is_published ? '👁️' : '👁️🗨️'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal(faq); }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(faq.id); }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                      {expandedId === faq.id ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {expandedId === faq.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                      <p className="text-gray-600 text-sm mt-3 whitespace-pre-line">{faq.answer}</p>
                      <p className="text-xs text-gray-400 mt-2">Sort order: {faq.sort_order}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {faqs?.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No FAQs yet. Add your first one!</p>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingFAQ ? 'Edit FAQ' : 'Add FAQ'}
        className="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Question"
            value={formData.question}
            onChange={(e) => setFormData((prev) => ({ ...prev, question: e.target.value }))}
            placeholder="What is your question?"
            required
          />
          <Textarea
            label="Answer"
            value={formData.answer}
            onChange={(e) => setFormData((prev) => ({ ...prev, answer: e.target.value }))}
            placeholder="Provide a clear, helpful answer..."
            rows={5}
            required
          />
          <Select
            label="Category"
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
          />
          <Input
            label="Sort Order"
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData((prev) => ({ ...prev, sort_order: e.target.value }))}
            placeholder="0"
          />
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
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createFAQ.isPending || updateFAQ.isPending}
            >
              {editingFAQ ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Move to Trash"
        message="Are you sure you want to move this FAQ to trash?"
        confirmLabel="Move to Trash"
        variant="warning"
        icon="warning"
      />
    </div>
  );
}
