import { useState, useRef, useCallback } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Plus, Edit2, Trash2, Images, X, Upload, Star, StarOff, Palette } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import {
  useGalleries,
  useGalleryCategories,
  useCreateGallery,
  useUpdateGallery,
  useTrashGallery,
  useCreateGalleryCategory,
  useUpdateGalleryCategory,
  useDeleteGalleryCategory,
  useAddGalleryImage,
  useDeleteGalleryImage,
  useSetDefaultImage,
  useUpdateGalleryImage,
} from '../../hooks/useGallery';
import type { Gallery, GalleryCategory } from '../../types/database';

export default function AdminGalleriesPage() {
  const { data: galleries, isLoading } = useGalleries();
  const { data: categories } = useGalleryCategories();
  const createGallery = useCreateGallery();
  const updateGallery = useUpdateGallery();
  const trashGallery = useTrashGallery();
  const createCategory = useCreateGalleryCategory();
  const updateCategory = useUpdateGalleryCategory();
  const deleteCategory = useDeleteGalleryCategory();
  const addImage = useAddGalleryImage();
  const deleteImage = useDeleteGalleryImage();
  const setDefaultImage = useSetDefaultImage();
  const updateImage = useUpdateGalleryImage();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGallery, setEditingGallery] = useState<Gallery | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    is_active: true,
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#eb6a3d' });
  const [editingCategory, setEditingCategory] = useState<GalleryCategory | null>(null);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showCategoryDeleteConfirm, setShowCategoryDeleteConfirm] = useState(false);
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<string | null>(null);

  const getCategory = (id: string | null) => categories?.find(c => c.id === id) || null;

  const getDisplayImage = (gallery: Gallery) => {
    if (gallery.default_image_url) return gallery.default_image_url;
    if (gallery.images && gallery.images.length > 0) return gallery.images[0].url;
    return null;
  };

  const openModal = (gallery?: Gallery) => {
    if (gallery) {
      setEditingGallery(gallery);
      setFormData({
        name: gallery.name,
        description: gallery.description || '',
        category_id: gallery.category_id || '',
        is_active: gallery.is_active,
      });
    } else {
      setEditingGallery(null);
      setFormData({
        name: '',
        description: '',
        category_id: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    try {
      if (editingGallery) {
        await updateGallery.mutateAsync({
          id: editingGallery.id,
          name: formData.name,
          description: formData.description || null,
          category_id: formData.category_id || null,
          is_active: formData.is_active,
        });
        showToast('Gallery updated successfully!');
      } else {
        await createGallery.mutateAsync({
          name: formData.name,
          description: formData.description || null,
          category_id: formData.category_id || null,
          is_active: formData.is_active,
        });
        showToast('Gallery created successfully!');
      }
      setIsModalOpen(false);
    } catch {
      showToast('Failed to save gallery', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await trashGallery.mutateAsync(deleteTarget);
        showToast('Gallery moved to trash!');
      } catch {
        showToast('Failed to delete gallery', 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const toggleActive = async (gallery: Gallery) => {
    try {
      await updateGallery.mutateAsync({
        id: gallery.id,
        is_active: !gallery.is_active,
      });
      showToast('Gallery status updated!');
    } catch {
      showToast('Failed to update gallery', 'error');
    }
  };

  const openCategoryModal = (category?: GalleryCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, color: category.color });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', color: '#eb6a3d' });
    }
    setIsCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          name: categoryForm.name,
          color: categoryForm.color,
        });
        showToast('Category updated!');
      } else {
        await createCategory.mutateAsync({
          name: categoryForm.name,
          color: categoryForm.color,
        });
        showToast('Category created!');
      }
      setIsCategoryModalOpen(false);
    } catch {
      showToast('Failed to save category', 'error');
    }
  };

  const handleDeleteCategory = (id: string) => {
    setCategoryDeleteTarget(id);
    setShowCategoryDeleteConfirm(true);
  };

  const handleConfirmCategoryDelete = async () => {
    if (categoryDeleteTarget) {
      try {
        await deleteCategory.mutateAsync(categoryDeleteTarget);
        showToast('Category deleted!');
      } catch {
        showToast('Failed to delete category', 'error');
      }
    }
    setShowCategoryDeleteConfirm(false);
    setCategoryDeleteTarget(null);
  };

  const openImageManager = (gallery: Gallery) => {
    setSelectedGallery(gallery);
    setIsImageModalOpen(true);
  };

  const handleAddImage = async () => {
    if (!newImageUrl.trim()) {
      showToast('Image URL is required', 'error');
      return;
    }

    if (!selectedGallery) return;

    try {
      const maxOrder = selectedGallery.images?.length || 0;
      await addImage.mutateAsync({
        gallery_id: selectedGallery.id,
        url: newImageUrl,
        caption: newImageCaption || null,
        sort_order: maxOrder + 1,
      });

      if (!selectedGallery.default_image_url) {
        await setDefaultImage.mutateAsync({
          galleryId: selectedGallery.id,
          imageUrl: newImageUrl,
        });
      }

      setNewImageUrl('');
      setNewImageCaption('');
      showToast('Image added successfully!');
    } catch {
      showToast('Failed to add image', 'error');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!selectedGallery) return;

    try {
      await deleteImage.mutateAsync(imageId);
      showToast('Image removed!');
    } catch {
      showToast('Failed to delete image', 'error');
    }
  };

  const handleSetDefaultImage = async (imageUrl: string) => {
    if (!selectedGallery) return;

    try {
      await setDefaultImage.mutateAsync({
        galleryId: selectedGallery.id,
        imageUrl,
      });
      showToast('Default image set!');
    } catch {
      showToast('Failed to set default image', 'error');
    }
  };

  const handleFileBrowse = useCallback(async (files: FileList) => {
    if (!selectedGallery) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const url = e.target?.result as string;
        const maxOrder = selectedGallery.images?.length || 0;

        try {
          await addImage.mutateAsync({
            gallery_id: selectedGallery.id,
            url,
            caption: file.name.replace(/\.[^/.]+$/, ''),
            sort_order: maxOrder + 1,
          });

          if (!selectedGallery.default_image_url) {
            await setDefaultImage.mutateAsync({
              galleryId: selectedGallery.id,
              imageUrl: url,
            });
          }
        } catch {
          showToast('Failed to add image', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
    showToast('Images added!');
  }, [selectedGallery, addImage, setDefaultImage, showToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileBrowse(e.dataTransfer.files);
    }
  }, [handleFileBrowse]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileBrowse(e.target.files);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const galleryList = galleries || [];
  const totalPages = Math.ceil(galleryList.length / pageSize);
  const paginatedItems = galleryList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Galleries</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your photo galleries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openCategoryModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Categories
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Gallery
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {categories?.map(cat => (
          <Badge
            key={cat.id}
            className="cursor-pointer hover:opacity-80"
            style={{ backgroundColor: cat.color + '20', color: cat.color }}
            onClick={() => openCategoryModal(cat)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {galleryList.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={galleryList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          position="top"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedItems.map((gallery) => {
          const category = getCategory(gallery.category_id);
          const displayImage = getDisplayImage(gallery);
          const imageCount = gallery.images?.length || 0;
          return (
            <Card key={gallery.id} className="hover:shadow-lg transition-shadow">
              <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={gallery.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                    <Images className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={gallery.is_active ? 'success' : 'gray'}>
                    {gallery.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {imageCount > 0 && (
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="primary">{imageCount} images</Badge>
                  </div>
                )}
                {category && (
                  <div className="absolute bottom-2 right-2">
                    <Badge style={{ backgroundColor: category.color + '20', color: category.color }}>
                      {category.name}
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent>
                <h3 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>{gallery.name}</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{gallery.description || 'No description'}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openImageManager(gallery)}>
                      <Images className="h-4 w-4 mr-1" />
                      Images
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(gallery)}>
                      {gallery.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" aria-label="Edit gallery" onClick={() => openModal(gallery)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Delete gallery" onClick={() => handleDelete(gallery.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {galleryList.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={galleryList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}

      {galleryList.length === 0 && (
        <div className="text-center py-12">
          <Images className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No galleries yet. Create your first one!</p>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGallery ? 'Edit Gallery' : 'Create Gallery'}
      >
        <div className="space-y-4">
          <Input
            label="Gallery Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Enter gallery name"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description"
          />
          <div>
            <label htmlFor="gallery-category" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Category</label>
            <select
              id="gallery-category"
              value={formData.category_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ 
                backgroundColor: 'var(--admin-input-bg)', 
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="">No category</option>
              {categories?.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createGallery.isPending || updateGallery.isPending}
            >
              {editingGallery ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Manage Categories"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Category name"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
              className="flex-1"
              required
            />
            <Input
              type="color"
              value={categoryForm.color}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
              className="w-16"
            />
            <Button
              onClick={saveCategory}
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {editingCategory ? 'Update' : 'Add'}
            </Button>
          </div>

          <div className="space-y-2">
            {categories?.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <Badge style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                  {cat.name}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" aria-label="Edit category" onClick={() => openCategoryModal(cat)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Delete category" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsCategoryModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        title={`Manage Images - ${selectedGallery?.name}`}
        className="max-w-4xl"
      >
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? 'border-primary-500 bg-primary-50' : ''
            }`}
            style={{ borderColor: isDragging ? 'var(--primary-color)' : 'var(--border-color)' }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>Drag and drop images here</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>or</p>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Browse Files
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Or paste image URL"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Input
              placeholder="Caption (optional)"
              value={newImageCaption}
              onChange={(e) => setNewImageCaption(e.target.value)}
              className="w-48"
            />
            <Button onClick={handleAddImage} disabled={addImage.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {selectedGallery?.images?.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No images yet. Add some above!
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedGallery?.images?.map((image) => {
                const isDefault = selectedGallery.default_image_url === image.url;
                return (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.url}
                      alt={image.caption || ''}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {isDefault && (
                      <div className="absolute top-2 left-2 bg-primary-500 text-white px-2 py-0.5 rounded text-xs flex items-center gap-1">
                        <Star className="h-3 w-3" /> Cover
                      </div>
                    )}
                    {image.paintable && (
                      <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-0.5 rounded text-xs flex items-center gap-1" style={isDefault ? { left: '80px' } : {}}>
                        <Palette className="h-3 w-3" /> Paintable
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isDefault && (
                        <button
                          onClick={() => handleSetDefaultImage(image.url)}
                          className="p-1 rounded shadow"
                          style={{ backgroundColor: 'var(--card-bg)' }}
                          title="Set as cover"
                        >
                          <StarOff className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteImage(image.id)}
                        className="bg-red-500 text-white p-1 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {image.caption && (
                      <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{image.caption}</p>
                    )}
                    <div className="mt-1 space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={image.paintable || false}
                          onChange={(e) => updateImage.mutate({ id: image.id, paintable: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Paintable</span>
                      </label>
                      {image.paintable && (
                        <div className="flex gap-2">
                          <select
                            value={image.difficulty || ''}
                            onChange={(e) => updateImage.mutate({ id: image.id, difficulty: (e.target.value || null) as 'beginner' | 'intermediate' | 'advanced' | null })}
                            className="text-xs rounded border px-1 py-0.5 flex-1"
                            style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          >
                            <option value="">No difficulty</option>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Min"
                            value={image.estimated_time_minutes || ''}
                            onChange={(e) => updateImage.mutate({ id: image.id, estimated_time_minutes: e.target.value ? parseInt(e.target.value) : null })}
                            className="text-xs rounded border px-1 py-0.5 w-16"
                            style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsImageModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Gallery"
        message="Are you sure you want to delete this gallery? It will be moved to trash."
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />

      <ConfirmDialog
        isOpen={showCategoryDeleteConfirm}
        onClose={() => setShowCategoryDeleteConfirm(false)}
        onConfirm={handleConfirmCategoryDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category? Galleries will lose their category."
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
