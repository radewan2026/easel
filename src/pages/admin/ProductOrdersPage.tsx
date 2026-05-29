import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProductOrders, useUpdateProductOrderStatus } from '../../hooks/useProducts';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { ArrowLeft } from 'lucide-react';

export default function AdminProductOrdersPage() {
  const { data: orders, isLoading } = useProductOrders();
  const updateStatus = useUpdateProductOrderStatus();
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [filter, orders]);

  const filteredOrders = orders?.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const totalItems = filteredOrders?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedOrders = filteredOrders?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#f59e0b20', text: '#f59e0b' },
      processing: { bg: '#3b82f620', text: '#3b82f6' },
      shipped: { bg: '#8b5cf620', text: '#8b5cf6' },
      delivered: { bg: '#22c55e20', text: '#22c55e' },
      cancelled: { bg: '#ef444420', text: '#ef4444' },
    };
    const color = colors[status] || colors.pending;
    return (
      <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: color.bg, color: color.text }}>
        {status}
      </span>
    );
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await updateStatus.mutateAsync({ id: orderId, status: newStatus });
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Product Orders</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage product orders and shipping</p>
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          position="top"
        />
      </div>

      <div className="space-y-4">
        {paginatedOrders?.map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {order.product?.name || 'Product'}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Order #{order.id.slice(0, 8)} | {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                {getStatusBadge(order.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Customer</p>
                  <p style={{ color: 'var(--text-primary)' }}>{order.purchaser_name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{order.purchaser_email}</p>
                  {order.purchaser_phone && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{order.purchaser_phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Order Details</p>
                  <p style={{ color: 'var(--text-primary)' }}>
                    {order.quantity} x ${order.unit_price.toFixed(2)} = ${order.total_price.toFixed(2)}
                  </p>
                  {order.shipping_address && (
                    <div className="mt-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Shipping</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {order.shipping_address}<br />
                        {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredOrders?.length === 0 && (
          <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No orders found</p>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        position="bottom"
      />
    </div>
  );
}
