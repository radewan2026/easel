import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useProductCategories, useCreateProductCategory, useDeleteProductCategory } from '../../hooks/useProducts';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Trash2, Plus, ArrowLeft, Tag } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export default function AdminProductCategoriesPage() {
  const { data: categories, isLoading } = useProductCategories();
  const createCategory = useCreateProductCategory();
  const deleteCategory = useDeleteProductCategory();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    display_order: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    try {
      await createCategory.mutateAsync({
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description || null,
        display_order: parseInt(formData.display_order) || 0,
      });
      showToast('Category created', 'success');
      setShowForm(false);
      setFormData({ name: '', slug: '', description: '', display_order: '' });
    } catch (err) {
      showToast('Failed to create category: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteCategory.mutateAsync(deleteTarget);
        showToast('Category deleted', 'success');
      } catch (err) {
        showToast('Failed to delete category: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6" style={{ backgroundColor: 'var(--admin-content)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Product Categories</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Organize your products</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Category Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="auto-generated"
                />
              </div>
              <Input
                label="Display Order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={createCategory.isPending}>Create Category</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {categories?.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{category.name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{category.slug}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Order: {category.display_order}</span>
                  <Button variant="ghost" size="sm" aria-label="Delete category" onClick={() => handleDelete(category.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {categories?.length === 0 && (
              <div className="text-center py-12">
                <Tag className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)' }}>No categories yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Create categories to organize your products.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}