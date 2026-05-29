import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useProducts, useProductCategories, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../../hooks/useProducts';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { Trash2, Plus, Edit, Image, Tag, ExternalLink } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import type { Product } from '../../types/database';

const PAGE_SIZE = 25;

export default function AdminProductsPage() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useProductCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    compare_at_price: '',
    image_url: '',
    images: [] as string[],
    category_id: '',
    is_active: true,
    stock: '',
    sku: '',
    weight_oz: '',
  });

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const uploadedUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;

      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...uploadedUrls],
      image_url: prev.image_url || uploadedUrls[0] || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
      description: formData.description || null,
      price: parseFloat(formData.price),
      compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
      image_url: formData.image_url || null,
      images: formData.images,
      category_id: formData.category_id || null,
      is_active: formData.is_active,
      stock: parseInt(formData.stock) || 0,
      sku: formData.sku || null,
      weight_oz: formData.weight_oz ? parseInt(formData.weight_oz) : null,
    };

    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
        showToast('Product updated', 'success');
      } else {
        await createProduct.mutateAsync(productData);
        showToast('Product created', 'success');
      }
      resetForm();
    } catch (err) {
      showToast('Failed to save product: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: '',
      compare_at_price: '',
      image_url: '',
      images: [],
      category_id: '',
      is_active: true,
      stock: '',
      sku: '',
      weight_oz: '',
    });
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      slug: product.slug || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      compare_at_price: product.compare_at_price?.toString() || '',
      image_url: product.image_url || '',
      images: product.images || [],
      category_id: product.category_id || '',
      is_active: product.is_active ?? true,
      stock: product.stock?.toString() || '',
      sku: product.sku || '',
      weight_oz: product.weight_oz?.toString() || '',
    });
    setShowForm(true);
    requestAnimationFrame(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteProduct.mutateAsync(deleteTarget);
        showToast('Product deleted', 'success');
      } catch (err) {
        showToast('Failed to delete product: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const totalProducts = products?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = products?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) || [];

  return (
    <div className="p-6 space-y-6" style={{ backgroundColor: 'var(--admin-content)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Products</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage your shop products</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/product-categories">
            <Button variant="secondary">
              <Tag className="h-4 w-4 mr-2" />
              Categories
            </Button>
          </Link>
          <Link to="/admin/product-orders">
            <Button variant="secondary">
              Orders
            </Button>
          </Link>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {showForm && (
        <div ref={formTopRef} className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Product Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="auto-generated-from-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(event) => setFormData(prev => ({ ...prev, description: event.target.value }))}
                  rows={10}
                  placeholder="Describe the product. Basic HTML is supported."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
                <Input
                  label="Compare at Price"
                  type="number"
                  step="0.01"
                  value={formData.compare_at_price}
                  onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })}
                />
                <Input
                  label="Stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="SKU"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
                <Input
                  label="Weight (oz)"
                  type="number"
                  value={formData.weight_oz}
                  onChange={(e) => setFormData({ ...formData, weight_oz: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="">No category</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
                <Input
                  label="Image URL"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Gallery Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => uploadImages(e.target.files).catch(console.error)}
                  className="block w-full text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
                {formData.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {formData.images.map((src, idx) => (
                      <div key={idx} className="relative rounded overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                        <img src={src} alt={`Gallery ${idx + 1}`} className="w-full h-20 object-cover" />
                        <button
                          type="button"
                          className="absolute top-1 right-1 rounded-full p-1"
                          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
                          onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" style={{ color: 'var(--text-primary)' }}>Active</label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Products</CardTitle>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalProducts} pageSize={PAGE_SIZE} onPageChange={setPage} position="top" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Product</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Category</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Price</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((product) => (
                  <tr key={product.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                            <Image className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{product.sku || 'No SKU'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                      {product.category?.name || '-'}
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                      ${product.price?.toFixed(2)}
                      {product.compare_at_price && (
                        <span className="ml-2 line-through text-sm" style={{ color: 'var(--text-muted)' }}>
                          ${product.compare_at_price.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                      {product.stock}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: product.is_active ? '#22c55e20' : '#ef444420',
                          color: product.is_active ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <a href={`/shop/${product.slug}`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalProducts} pageSize={PAGE_SIZE} onPageChange={setPage} position="bottom" />
      </CardContent>
    </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
