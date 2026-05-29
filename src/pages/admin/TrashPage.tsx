import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrashedEvents, useRestoreEvent, usePermanentDeleteEvent } from '../../hooks/useEvents';
import { useTrashedVenues, useRestoreVenue, usePermanentDeleteVenue } from '../../hooks/useEvents';
import { useTrashedBlogPosts, useRestoreBlogPost, usePermanentDeleteBlogPost } from '../../hooks/useBlog';
import { useTrashedGalleries, useRestoreGallery, usePermanentDeleteGallery } from '../../hooks/useGallery';
import { useTrashedCoupons, useRestoreCoupon, usePermanentDeleteCoupon } from '../../hooks/useEvents';
import { formatDate } from '../../lib/utils';
import { Trash2, RotateCcw, X, Calendar, MapPin, FileText, Tag, Images } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';

type TrashItem = {
  id: string;
  type: 'event' | 'venue' | 'blog' | 'gallery' | 'coupon';
  title: string;
  deletedAt: string;
  originalData?: unknown;
};

export default function TrashPage() {
  const { data: trashedEvents, isLoading: eventsLoading } = useTrashedEvents();
  const { data: trashedVenues, isLoading: venuesLoading } = useTrashedVenues();
  const { data: trashedBlogPosts, isLoading: blogLoading } = useTrashedBlogPosts();
  const { data: trashedGalleries, isLoading: galleriesLoading } = useTrashedGalleries();
  const { data: trashedCoupons, isLoading: couponsLoading } = useTrashedCoupons();
  
  const restoreEvent = useRestoreEvent();
  const permanentDeleteEvent = usePermanentDeleteEvent();
  const restoreVenue = useRestoreVenue();
  const permanentDeleteVenue = usePermanentDeleteVenue();
  const restoreBlogPost = useRestoreBlogPost();
  const permanentDeleteBlogPost = usePermanentDeleteBlogPost();
  const restoreGallery = useRestoreGallery();
  const permanentDeleteGallery = usePermanentDeleteGallery();
  const restoreCoupon = useRestoreCoupon();
  const permanentDeleteCoupon = usePermanentDeleteCoupon();
  
  const { showToast } = useToast();
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const isLoading = eventsLoading || venuesLoading || blogLoading || galleriesLoading || couponsLoading;

  const allTrashedItems: TrashItem[] = [
    ...(trashedEvents?.map(e => ({
      id: e.id,
      type: 'event' as const,
      title: e.title,
      deletedAt: e.created_at,
      originalData: e
    })) || []),
    ...(trashedVenues?.map(v => ({
      id: v.id,
      type: 'venue' as const,
      title: v.name,
      deletedAt: v.created_at,
      originalData: v
    })) || []),
    ...(trashedBlogPosts?.map(b => ({
      id: b.id,
      type: 'blog' as const,
      title: b.title,
      deletedAt: b.updated_at,
      originalData: b
    })) || []),
    ...(trashedGalleries?.map(g => ({
      id: g.id,
      type: 'gallery' as const,
      title: g.name,
      deletedAt: g.updated_at,
      originalData: g
    })) || []),
    ...(trashedCoupons?.map(c => ({
      id: c.id,
      type: 'coupon' as const,
      title: c.code,
      deletedAt: c.updated_at,
      originalData: c
    })) || []),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const totalPages = Math.ceil(allTrashedItems.length / pageSize);
  const paginatedItems = allTrashedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleRestore = async (item: TrashItem) => {
    try {
      switch (item.type) {
        case 'event':
          await restoreEvent.mutateAsync(item.id);
          showToast('Event restored!');
          break;
        case 'venue':
          await restoreVenue.mutateAsync(item.id);
          showToast('Venue restored!');
          break;
        case 'blog':
          await restoreBlogPost.mutateAsync(item.id);
          showToast('Blog post restored!');
          break;
        case 'gallery':
          await restoreGallery.mutateAsync(item.id);
          showToast('Gallery restored!');
          break;
        case 'coupon':
          await restoreCoupon.mutateAsync(item.id);
          showToast('Coupon restored!');
          break;
      }
    } catch {
      showToast('Failed to restore item', 'error');
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedItem) return;
    try {
      switch (selectedItem.type) {
        case 'event':
          await permanentDeleteEvent.mutateAsync(selectedItem.id);
          showToast('Event permanently deleted!');
          break;
        case 'venue':
          await permanentDeleteVenue.mutateAsync(selectedItem.id);
          showToast('Venue permanently deleted!');
          break;
        case 'blog':
          await permanentDeleteBlogPost.mutateAsync(selectedItem.id);
          showToast('Blog post permanently deleted!');
          break;
        case 'gallery':
          await permanentDeleteGallery.mutateAsync(selectedItem.id);
          showToast('Gallery permanently deleted!');
          break;
        case 'coupon':
          await permanentDeleteCoupon.mutateAsync(selectedItem.id);
          showToast('Coupon permanently deleted!');
          break;
      }
      setSelectedItem(null);
    } catch {
      showToast('Failed to delete item', 'error');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'event': return Calendar;
      case 'venue': return MapPin;
      case 'blog': return FileText;
      case 'gallery': return Images;
      case 'coupon': return Tag;
      default: return Trash2;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'event': return 'Event';
      case 'venue': return 'Venue';
      case 'blog': return 'Blog Post';
      case 'gallery': return 'Gallery';
      case 'coupon': return 'Coupon';
      default: return 'Item';
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trash</h1>
          <p className="text-gray-500">Deleted items that can be restored or permanently removed</p>
        </div>
        <Link to="/admin">
          <Button variant="ghost">Back to Dashboard</Button>
        </Link>
      </div>

      {allTrashedItems.length === 0 ? (
        <div className="text-center py-12">
          <Trash2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Trash is empty</p>
          <p className="text-gray-400">Items you delete will appear here</p>
        </div>
      ) : (
        <>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={allTrashedItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="top"
          />
          <div className="space-y-4">
            {paginatedItems.map((item) => {
            const Icon = getTypeIcon(item.type);
            return (
              <Card key={`${item.type}-${item.id}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Icon className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.title}</span>
                        <Badge variant="gray">{getTypeLabel(item.type)}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">Deleted {formatDate(item.deletedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(item)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete permanently"
                      onClick={() => setSelectedItem(item)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={allTrashedItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="Permanently Delete?"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to permanently delete "<strong>{selectedItem?.title}</strong>"? 
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setSelectedItem(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handlePermanentDelete}
              disabled={permanentDeleteEvent.isPending || permanentDeleteVenue.isPending || permanentDeleteBlogPost.isPending || permanentDeleteGallery.isPending || permanentDeleteCoupon.isPending}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
