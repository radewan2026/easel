import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useBlogPosts,
  useBlogCategories,
  useDeleteBlogPost,
  useTrashBlogPost,
  useCreateBlogCategory,
} from '../../hooks/useBlog';
import { formatDate, slugify } from '../../lib/utils';
import { Plus, Edit2, Trash2, ExternalLink, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';

export default function AdminBlogPage() {
  const navigate = useNavigate();
  const { data: posts, isLoading } = useBlogPosts();
  const { data: categories } = useBlogCategories();
  const deletePost = useDeleteBlogPost();
  const trashPost = useTrashBlogPost();
  const createCategory = useCreateBlogCategory();
  const { showToast } = useToast();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [categorySlug, setCategorySlug] = useState('');
  const [categoryName, setCategoryName] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.ceil((posts?.length ?? 0) / pageSize);
  const paginatedPosts = posts?.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [trashTarget, setTrashTarget] = useState<string | null>(null);

  const handleConfirmTrash = async () => {
    if (trashTarget) {
      try {
        await trashPost.mutateAsync(trashTarget);
        showToast('Post moved to trash!');
      } catch {
        try {
          await deletePost.mutateAsync(trashTarget);
          showToast('Post deleted!');
        } catch {
          showToast('Failed to delete post', 'error');
        }
      }
    }
    setShowTrashConfirm(false);
    setTrashTarget(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
          <p className="text-gray-500">Manage blog posts</p>
        </div>
        <Button onClick={() => navigate('/admin/blog/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <Card className="flex-1">
          <CardContent className="py-4">
            <h3 className="font-medium text-gray-900 mb-2">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories?.map((cat) => (
                <Badge key={cat.id} variant="primary">
                  {cat.name}
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCategoryModalOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Posts</CardTitle>
            {posts && posts.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={posts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                position="top"
              />
            )}
          </CardHeader>
          <CardContent>
            {!posts || posts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No blog posts yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Write your first post to engage your audience.</p>
              </div>
            ) : (
            <div className="space-y-4">
              {paginatedPosts?.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    {post.header_image_url ? (
                      <img
                        src={post.header_image_url}
                        alt={post.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No image</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{post.title}</h3>
                        <Badge variant={post.is_published ? 'success' : 'gray'}>
                          {post.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      {post.excerpt && (
                        <p className="text-sm text-gray-500 mt-1">{post.excerpt}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {post.published_at ? formatDate(post.published_at) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {post.is_published && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                        title="View post"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" aria-label="Edit post" onClick={() => navigate(`/admin/blog/${post.id}`)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete post"
                      onClick={() => {
                        setTrashTarget(post.id);
                        setShowTrashConfirm(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
          {posts && posts.length > 0 && (
            <div className="px-6 pb-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={posts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                position="bottom"
              />
            </div>
          )}
         </Card>
       )}

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Category"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Category name"
            required
          />
          <Input
            label="Slug"
            value={categorySlug}
            onChange={(e) => setCategorySlug(slugify(e.target.value))}
            placeholder="category-slug"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!categoryName.trim() || !categorySlug.trim()) {
                  showToast('Category name and slug are required', 'error');
                  return;
                }
                try {
                  await createCategory.mutateAsync({
                    name: categoryName,
                    slug: categorySlug,
                  });
                  showToast('Category created', 'success');
                  setIsCategoryModalOpen(false);
                  setCategoryName('');
                  setCategorySlug('');
                } catch (err) {
                  showToast('Failed to create category: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
                }
              }}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showTrashConfirm}
        onClose={() => setShowTrashConfirm(false)}
        onConfirm={handleConfirmTrash}
        title="Move to Trash"
        message="Are you sure you want to move this post to trash?"
        confirmLabel="Move to Trash"
        variant="warning"
        icon="warning"
      />
    </div>
  );
}
