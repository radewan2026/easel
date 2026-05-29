import { useState, useMemo, useEffect } from 'react';
import { useOrders, useUpdateOrderStatus, useRefundOrder } from '../../hooks/useEvents';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { logActivity } from '../../lib/activityLog';
import { ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { useEvents } from '../../hooks/useEvents';
import type { Order } from '../../types/database';

type SortField = 'id' | 'event' | 'purchaser_name' | 'quantity' | 'total_amount' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';
type SortValue = string | number;

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1 inline" /> : <ArrowDown className="h-4 w-4 ml-1 inline" />;
}

function getOrderSortValue(order: Order, field: SortField): SortValue {
  switch (field) {
    case 'event':
      return order.event?.title || '';
    case 'quantity':
      return order.total_seats;
    case 'total_amount':
      return order.total_amount;
    case 'id':
      return order.id;
    case 'purchaser_name':
      return order.purchaser_name;
    case 'status':
      return order.status;
    case 'created_at':
      return order.created_at;
  }
}

export default function AdminSalesPage() {
  const { data: orders, isLoading } = useOrders();
  const { data: events } = useEvents();
  const updateOrderStatus = useUpdateOrderStatus();
  const refundOrder = useRefundOrder();
  const { showToast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [notifyAttendee, setNotifyAttendee] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [eventFilter, statusFilter, dateFilter, dateFrom, dateTo]);

  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
    pending: 'warning',
    paid: 'success',
    cancelled: 'danger',
    refunded: 'danger',
  };

  const getDateRange = (filter: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return { start: today, end: now };
      case 'last7':
        return { start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
      case 'last30':
        return { start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
      case 'thisMonth':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
      case 'thisYear':
        return { start: new Date(now.getFullYear(), 0, 1), end: now };
      default:
        return null;
    }
  };

  const filteredOrders = orders?.filter((order) => {
    if (eventFilter && order.event_id !== eventFilter) return false;
    if (statusFilter && order.status !== statusFilter) return false;
    if (dateFilter) {
      const range = getDateRange(dateFilter);
      if (range) {
        const orderDate = new Date(order.created_at);
        if (orderDate < range.start || orderDate > range.end) return false;
      }
    }
    if (dateFrom || dateTo) {
      const orderDate = new Date(order.created_at);
      if (dateFrom && orderDate < new Date(dateFrom)) return false;
      if (dateTo && orderDate > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedOrders = useMemo(() => {
    if (!filteredOrders) return [];
    return [...filteredOrders].sort((a, b) => {
      const aVal = getOrderSortValue(a, sortField);
      const bVal = getOrderSortValue(b, sortField);
      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredOrders, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const paginatedOrders = sortedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await updateOrderStatus.mutateAsync({ id: orderId, status: newStatus });
    setSelectedOrder(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sales</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and manage orders</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Select
          options={[
            { value: '', label: 'All Events' },
            ...(events?.map((e) => ({ value: e.id, label: e.title })) || []),
          ]}
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'refunded', label: 'Refunded' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40 text-left"
        />
        <Select
          options={[
            { value: '', label: 'All Dates' },
            { value: 'today', label: 'Today' },
            { value: 'last7', label: 'Last 7 Days' },
            { value: 'last30', label: 'Last 30 Days' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'thisYear', label: 'This Year' },
          ]}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-40 text-left"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ 
              backgroundColor: 'var(--admin-input-bg)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ 
              backgroundColor: 'var(--admin-input-bg)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Orders</CardTitle>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sortedOrders.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
<tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('id')}>
                      Order ID <SortIcon field="id" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('event')}>
                      Event <SortIcon field="event" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('purchaser_name')}>
                      Name <SortIcon field="purchaser_name" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('quantity')}>
                      Qty <SortIcon field="quantity" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('total_amount')}>
                      Amount <SortIcon field="total_amount" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('status')}>
                      Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('created_at')}>
                      Date <SortIcon field="created_at" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 transition-colors cursor-pointer" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
                          {order.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                        {order.event?.title || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div style={{ color: 'var(--text-primary)' }}>{order.purchaser_name}</div>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{order.purchaser_email}</div>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{order.total_seats}</td>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusColors[order.status]}>{order.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sortedOrders.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Order Details"
        className="max-w-lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedOrder.event?.title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {selectedOrder.event?.start_datetime &&
                    formatDateTime(selectedOrder.event.start_datetime)}
                </p>
              </div>
              <Badge variant={statusColors[selectedOrder.status]}>
                {selectedOrder.status}
              </Badge>
            </div>

            <div className="border-t border-b py-4" style={{ borderColor: 'var(--border-color)' }}>
              <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Purchaser</h4>
              <p style={{ color: 'var(--text-secondary)' }}>{selectedOrder.purchaser_name}</p>
              <p style={{ color: 'var(--text-secondary)' }}>{selectedOrder.purchaser_email}</p>
              {selectedOrder.purchaser_phone && (
                <p style={{ color: 'var(--text-secondary)' }}>{selectedOrder.purchaser_phone}</p>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Order Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>Seats</span>
                  <span>{selectedOrder.total_seats}</span>
                </div>
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal_amount)}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold" style={{ color: 'var(--text-primary)' }}>
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {selectedOrder.attendees && selectedOrder.attendees.length > 0 && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Attendees</h4>
                <div className="space-y-2">
                  {selectedOrder.attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex justify-between py-2 border-b"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>{attendee.full_name}</span>
                      {attendee.email && (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{attendee.email}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedOrder.refund_reason && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)', border: '1px solid var(--border-color)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Refund Reason</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedOrder.refund_reason}</p>
                {selectedOrder.refunded_at && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Refunded: {formatDateTime(selectedOrder.refunded_at)}</p>
                )}
              </div>
            )}

            <div className="pt-4 space-y-3">
              {selectedOrder.status !== 'refunded' && selectedOrder.status !== 'cancelled' ? (
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowRefundModal(true)}
                    className="btn-refund flex items-center gap-2 rounded-lg px-4 py-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Refund Order
                  </Button>
                  <div className="flex-1">
                    <Select
                      options={[
                        { value: selectedOrder.status, label: selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1) },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                      value={selectedOrder.status}
                      onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                      className="text-left w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  This order is {selectedOrder.status}.
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await handleStatusChange(selectedOrder.id, 'paid');
                    }}
                    className="ml-2"
                  >
                    Reopen as Paid
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Refund Order"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)', border: '1px solid var(--border-color)' }}>
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary-color)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Refund {formatCurrency(selectedOrder?.total_amount || 0)} for {selectedOrder?.purchaser_name}?
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                This will mark the order as refunded. This action can be reversed.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Reason (optional)</label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Enter refund reason..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyAttendee}
              onChange={(e) => setNotifyAttendee(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Send refund notification email to attendee</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                try {
                  await refundOrder.mutateAsync({
                    id: selectedOrder!.id,
                    reason: refundReason,
                    notifyAttendee,
                  });
                  await logActivity({
                    action: 'order.refunded',
                    entityType: 'order',
                    entityId: selectedOrder!.id,
                    entityName: `${selectedOrder!.purchaser_name} - ${formatCurrency(selectedOrder!.total_amount)}`,
                    details: { reason: refundReason || 'No reason provided', notified: notifyAttendee },
                  });
                  showToast('Order refunded successfully');
                  setShowRefundModal(false);
                  setRefundReason('');
                  setSelectedOrder(null);
                } catch (err: unknown) {
                  showToast('Refund failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
                }
              }}
              disabled={refundOrder.isPending}
            >
              {refundOrder.isPending ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
