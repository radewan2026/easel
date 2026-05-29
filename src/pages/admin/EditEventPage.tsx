import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useEvents, useVenues, useUpdateEvent, useCreateEvent, generateRecurringEvents, useOrders, useUpdateOrderStatus, useEmailBroadcasts, useCreateEmailBroadcast, useUpdateEmailBroadcast, useDeleteEmailBroadcast, useEventAttendeeEmails } from '../../hooks/useEvents';
import { formatDateTime, formatCurrency, slugify } from '../../lib/utils';
import { AlertTriangle, ArrowLeft, Save, Upload, X, Image as ImageIcon, Sparkles, Lightbulb, Repeat, ArrowUpDown, ArrowUp, ArrowDown, Send, Mail, Trash2, Eye, MailOpen, CalendarClock, Users, CheckCircle2, DollarSign, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import RescheduleModal from '../../components/admin/RescheduleModal';
import { StaffTab } from '../../components/admin/StaffTab';
import { useEventAssignments } from '../../hooks/useEventAssignments';
import { useProducts } from '../../hooks/useProducts';
import { useEventAddOns, type EventAddOn } from '../../hooks/useEventAddOns';
import { useWaitlist } from '../../hooks/useWaitlist';
import type { Order, EmailBroadcast, Event, EventAssignment } from '../../types/database';

type SortField = 'id' | 'event' | 'purchaser_name' | 'quantity' | 'total_amount' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';
type OrderSortValue = string | number | null;
type EventRecurrence = { type?: string; end_date?: string | null; count?: number | null };
type ReadinessLevel = 'ready' | 'warning' | 'blocked';
type ReadinessCheck = {
  label: string;
  detail: string;
  level: ReadinessLevel;
  required?: boolean;
};

type AssistantDraftEvent = {
  title?: string;
  start_datetime?: string;
  base_price_per_seat?: number;
  max_seats?: number;
  description?: string;
};

function getOrderSortValue(order: Order, field: SortField): OrderSortValue {
  if (field === 'event') return order.event?.title || '';
  if (field === 'quantity') return order.total_seats;
  const value = order[field as keyof Order];
  if (typeof value === 'string' || typeof value === 'number') return value;
  return null;
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1 inline" /> : <ArrowDown className="h-4 w-4 ml-1 inline" />;
}

function CommandCenterTab({
  event,
  assignments,
  readiness,
  addOns,
  onOpenTab,
}: {
  event: Event;
  assignments: EventAssignment[];
  readiness: { checks: ReadinessCheck[]; blockedRequired: ReadinessCheck[]; warnings: ReadinessCheck[]; score: number };
  addOns: EventAddOn[];
  onOpenTab: (tab: 'details' | 'sales' | 'staff' | 'broadcast' | 'sent') => void;
}) {
  const { data: orders = [], isLoading: ordersLoading } = useOrders(event.id);
  const { data: waitlist = [] } = useWaitlist(event.id);

  const paidOrders = orders.filter((order) => order.status === 'paid');
  const activeOrders = orders.filter((order) => !['cancelled', 'refunded'].includes(order.status));
  const seatsSold = activeOrders.reduce((sum, order) => sum + order.total_seats, 0);
  const revenue = paidOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const capacity = event.max_seats || event.seats_available || 0;
  const fillRate = capacity ? Math.round((seatsSold / capacity) * 100) : 0;
  const activeAssignments = assignments.filter((assignment) => assignment.status !== 'declined');
  const confirmedAssignments = activeAssignments.filter((assignment) => ['confirmed', 'completed'].includes(assignment.status));
  const addOnPotential = addOns.reduce((sum, addOn) => sum + addOn.price * Math.min(addOn.maxQuantity, addOn.stock || addOn.maxQuantity), 0);
  const attendeeRows = activeOrders.flatMap((order) => order.attendees?.length ? order.attendees.map((attendee) => ({
    id: attendee.id,
    name: attendee.full_name,
    email: attendee.email || order.purchaser_email,
    status: order.status,
  })) : [{
    id: order.id,
    name: order.purchaser_name,
    email: order.purchaser_email,
    status: order.status,
  }]).slice(0, 6);

  const prepItems = [
    { label: 'Public page and image ready', ready: Boolean(event.is_published && event.main_image_url) },
    { label: 'Staff assigned', ready: activeAssignments.length > 0 },
    { label: 'Staff confirmed', ready: activeAssignments.length > 0 && confirmedAssignments.length === activeAssignments.length },
    { label: 'Roster has booked guests', ready: seatsSold > 0 },
    { label: 'Add-ons reviewed', ready: addOns.length === 0 || addOns.every((addOn) => addOn.stock >= Math.min(addOn.maxQuantity, addOn.stock || addOn.maxQuantity)) },
    { label: 'Customer message path ready', ready: true },
  ];

  const nextActions = [
    ...(readiness.blockedRequired.length ? [{ label: `Fix ${readiness.blockedRequired[0].label.toLowerCase()}`, tab: 'details' as const, tone: 'danger' }] : []),
    ...(activeAssignments.length === 0 ? [{ label: 'Assign staff', tab: 'staff' as const, tone: 'warning' }] : []),
    ...(activeAssignments.length > confirmedAssignments.length ? [{ label: 'Confirm staffing', tab: 'staff' as const, tone: 'warning' }] : []),
    ...(fillRate < 50 ? [{ label: 'Promote low-fill event', tab: 'broadcast' as const, tone: 'warning' }] : []),
    ...(orders.length ? [{ label: 'Review roster', tab: 'sales' as const, tone: 'neutral' }] : []),
    { label: 'Message attendees', tab: 'broadcast' as const, tone: 'neutral' },
  ].slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Readiness</p>
            <p className="text-2xl font-bold" style={{ color: readiness.blockedRequired.length ? '#dc2626' : readiness.warnings.length ? '#d97706' : '#16a34a' }}>{readiness.score}%</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{readiness.blockedRequired.length} blockers · {readiness.warnings.length} warnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Fill Rate</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fillRate}%</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{seatsSold} / {capacity || 'unlimited'} seats</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Revenue</p>
            <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{formatCurrency(revenue)}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{paidOrders.length} paid order{paidOrders.length === 1 ? '' : 's'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Add-On Potential</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(addOnPotential)}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{addOns.length} active option{addOns.length === 1 ? '' : 's'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Event Night Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prepItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                {item.ready ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#16a34a' }} />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: '#d97706' }} />
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onOpenTab(action.tab)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                <span className="text-xs" style={{ color: action.tone === 'danger' ? '#dc2626' : action.tone === 'warning' ? '#d97706' : 'var(--text-muted)' }}>
                  Open
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Roster Preview</CardTitle>
              <Button variant="outline" size="sm" onClick={() => onOpenTab('sales')}>Open Sales</Button>
            </div>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <LoadingSpinner />
            ) : attendeeRows.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No booked attendees yet.</p>
            ) : (
              <div className="space-y-2">
                {attendeeRows.map((attendee) => (
                  <div key={attendee.id} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{attendee.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{attendee.email}</p>
                    </div>
                    <Badge variant={attendee.status === 'paid' ? 'success' : 'warning'}>{attendee.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Staff And Waitlist</CardTitle>
              <Button variant="outline" size="sm" onClick={() => onOpenTab('staff')}>Open Staff</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Assigned Staff</p>
              {activeAssignments.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No staff assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {activeAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{assignment.employee?.name || 'Assigned employee'}</span>
                      <Badge variant={assignment.status === 'confirmed' || assignment.status === 'completed' ? 'success' : 'warning'}>{assignment.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Waitlist</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {waitlist.length} waitlist entr{waitlist.length === 1 ? 'y' : 'ies'} · {waitlist.reduce((sum, item) => sum + (item.seats_desired || 0), 0)} requested seat{waitlist.reduce((sum, item) => sum + (item.seats_desired || 0), 0) === 1 ? '' : 's'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getEventRecurrence(recurrence: unknown): EventRecurrence | null {
  if (!recurrence || typeof recurrence !== 'object') return null;
  return recurrence as EventRecurrence;
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (part: number) => part.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function SalesTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const { data: allOrders, isLoading } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
    pending: 'warning',
    paid: 'success',
    cancelled: 'danger',
    refunded: 'danger',
  };

  const filteredOrders = allOrders?.filter((order) => {
    if (order.event_id !== eventId) return false;
    if (statusFilter && order.status !== statusFilter) return false;
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
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredOrders, sortField, sortDirection]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await updateOrderStatus.mutateAsync({ id: orderId, status: newStatus });
    setSelectedOrder(null);
  };

  const totalRevenue = (filteredOrders || [])
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const totalSeats = (filteredOrders || [])
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + o.total_seats, 0);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Orders</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{filteredOrders?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Seats Sold</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalSeats}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Revenue</p>
            <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="w-40">
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
          />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>From:</span>
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
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>To:</span>
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

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Orders for {eventTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort('id')}>
                      Order ID <SortIcon field="id" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort('purchaser_name')}>
                      Purchaser <SortIcon field="purchaser_name" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort('quantity')}>
                      Seats <SortIcon field="quantity" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort('total_amount')}>
                      Total <SortIcon field="total_amount" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort('status')}>
                      Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort('created_at')}>
                      Date <SortIcon field="created_at" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No orders found for this event.</td>
                    </tr>
                  ) : (
                    sortedOrders.map((order) => (
                      <tr key={order.id} className="border-b" style={{ borderColor: 'var(--border-color)', opacity: 0.7 }}>
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
                            {order.id.slice(0, 8)}
                          </span>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                  <div className="flex justify-between" style={{ color: '#22c55e' }}>
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
                      style={{ borderColor: 'var(--border-color)', opacity: 0.7 }}
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

            <div className="pt-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Update Status
              </label>
              <Select
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'cancelled', label: 'Cancelled' },
                  { value: 'refunded', label: 'Refunded' },
                ]}
                value={selectedOrder.status}
                onChange={(e) =>
                  handleStatusChange(selectedOrder.id, e.target.value)
                }
                className="text-left"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EmailBroadcastsTab({ eventId }: { eventId: string }) {
  const { data: broadcasts } = useEmailBroadcasts(eventId);
  const { data: attendeeEmails } = useEventAttendeeEmails(eventId);
  const createBroadcast = useCreateEmailBroadcast();
  const updateBroadcast = useUpdateEmailBroadcast();
  const deleteBroadcast = useDeleteEmailBroadcast();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ subject: '', body: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.subject.trim() || !formData.body.trim()) {
      showToast('Please fill in subject and body');
      return;
    }

    if (editingId) {
      await updateBroadcast.mutateAsync({ id: editingId, subject: formData.subject, body: formData.body });
      showToast('Draft updated');
    } else {
      await createBroadcast.mutateAsync({
        event_id: eventId,
        subject: formData.subject,
        body: formData.body,
        recipient_count: attendeeEmails?.length || 0,
        status: 'draft',
      });
      showToast('Draft saved');
    }

    setFormData({ subject: '', body: '' });
    setEditingId(null);
  };

  const handleSend = async () => {
    if (!formData.subject.trim() || !formData.body.trim()) {
      showToast('Please fill in subject and body');
      return;
    }

    await createBroadcast.mutateAsync({
      event_id: eventId,
      subject: formData.subject,
      body: formData.body,
      recipient_count: attendeeEmails?.length || 0,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    setFormData({ subject: '', body: '' });
    showToast(`Email sent to ${attendeeEmails?.length || 0} attendees`);
  };

  const handleEdit = (broadcast: EmailBroadcast) => {
    setFormData({ subject: broadcast.subject, body: broadcast.body });
    setEditingId(broadcast.id);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteBroadcast.mutateAsync(deleteTarget);
      showToast('Broadcast deleted');
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const drafts = broadcasts?.filter(b => b.status === 'draft') || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Recipients: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{attendeeEmails?.length || 0} attendees</span>
            </p>
            {attendeeEmails && attendeeEmails.length > 0 && (
              <button
                onClick={() => setShowPreview(true)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                Preview emails
              </button>
            )}
          </div>

          <Input
            label="Subject"
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Email subject line"
          />

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Body</label>
            <Textarea
              value={formData.body}
              onChange={(event) => setFormData(prev => ({ ...prev, body: event.target.value }))}
              rows={10}
              placeholder="Write the broadcast body. Basic HTML is supported."
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={createBroadcast.isPending || updateBroadcast.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {editingId ? 'Update Draft' : 'Save Draft'}
            </Button>
            <Button onClick={handleSend} disabled={createBroadcast.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Send to All Attendees
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={() => { setFormData({ subject: '', body: '' }); setEditingId(null); }}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drafts.map(broadcast => (
                <div key={broadcast.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{broadcast.subject}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {broadcast.recipient_count} recipients · Created {formatDateTime(broadcast.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(broadcast)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(broadcast.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Email Recipients" className="max-w-lg">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {attendeeEmails?.map((email, idx) => (
            <div key={idx} className="py-2 px-3 rounded text-sm" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-primary)' }}>{email}</div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Broadcast"
        message="Are you sure you want to delete this broadcast?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
        isLoading={deleteBroadcast.isPending}
      />
    </div>
  );
}

function EmailsSentTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const { data: broadcasts, isLoading } = useEmailBroadcasts(eventId);
  const deleteBroadcast = useDeleteEmailBroadcast();
  const { showToast } = useToast();

  const [selectedBroadcast, setSelectedBroadcast] = useState<EmailBroadcast | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const sentEmails = broadcasts?.filter(b => b.status === 'sent') || [];

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteBroadcast.mutateAsync(deleteTarget);
      showToast('Record deleted');
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
    sent: 'success',
    draft: 'gray',
    scheduled: 'warning',
    failed: 'danger',
  };

  return (
    <div>
      {isLoading ? (
        <LoadingSpinner />
      ) : sentEmails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MailOpen className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No emails have been sent yet.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Compose and send emails from the Email Broadcasts tab.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Emails Sent for {eventTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
<tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Subject</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Recipients</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Sent At</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sentEmails.map(broadcast => (
                    <tr key={broadcast.id} className="border-b" style={{ borderColor: 'var(--border-color)', opacity: 0.7 }}>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{broadcast.subject}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{broadcast.recipient_count}</td>
                      <td className="py-3 px-4">
                        <Badge variant={statusColors[broadcast.status]}>{broadcast.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {broadcast.sent_at ? formatDateTime(broadcast.sent_at) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedBroadcast(broadcast)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(broadcast.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={!!selectedBroadcast} onClose={() => setSelectedBroadcast(null)} title="Email Preview" className="max-w-2xl">
        {selectedBroadcast && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Subject</h4>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedBroadcast.subject}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Body</h4>
              <div
                className="prose max-w-none mt-2 p-4 rounded-lg"
                style={{ backgroundColor: 'var(--section-bg-light)' }}
                dangerouslySetInnerHTML={{ __html: selectedBroadcast.body }}
              />
            </div>
            <div className="flex justify-between text-sm pt-2 border-t" style={{ color: 'var(--text-muted)' }}>
              <span>{selectedBroadcast.recipient_count} recipients</span>
              <span>Sent {selectedBroadcast.sent_at ? formatDateTime(selectedBroadcast.sent_at) : '-'}</span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Email Record"
        message="Are you sure you want to delete this sent email record?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
        isLoading={deleteBroadcast.isPending}
      />
    </div>
  );
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id || id === 'new';
  
  const { data: allEvents, isLoading: eventsLoading } = useEvents();
  const { data: venues } = useVenues();
  const { data: products = [] } = useProducts({ active: true });
  
  const existingEvent = allEvents?.find(e => e.id === id);
  const { data: assignments = [] } = useEventAssignments({ event_id: id && id !== 'new' ? id : 'new-event-draft' });
  
  const updateEvent = useUpdateEvent();
  const createEvent = useCreateEvent();

  const [activeTab, setActiveTab] = useState<'details' | 'command' | 'sales' | 'staff' | 'broadcast' | 'sent'>('details');

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    venue_id: '',
    base_price_per_seat: '',
    max_seats: '',
    seats_available: '',
    main_image_url: '',
    is_published: false,
    is_archived: false,
    recurrence_type: '',
    recurrence_end_date: '',
    recurrence_count: '',
  });
  const [pricingPreview, setPricingPreview] = useState({
    taxRate: '0',
    processingPercent: '2.9',
    processingFixed: '0.30',
    addOns: '0',
    seats: '1',
  });
  const eventAddOnSlug = formData.slug || existingEvent?.slug || '';
  const { addOns: eventAddOns, enabledAddOns, updateAddOn } = useEventAddOns(eventAddOnSlug, products);

  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { showToast } = useToast();

  const [showHeadlineIdeas, setShowHeadlineIdeas] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const initializedRef = useRef(false);
  const assistantDraft = (location.state as { assistantDraftEvent?: AssistantDraftEvent } | null)?.assistantDraftEvent;

  useEffect(() => {
    if (existingEvent && !initializedRef.current) {
      initializedRef.current = true;
      const recurrence = getEventRecurrence(existingEvent.recurrence);
      queueMicrotask(() => {
        setFormData({
          title: existingEvent.title || '',
          slug: existingEvent.slug || '',
          description: existingEvent.description || '',
          start_datetime: toDateTimeLocalValue(existingEvent.start_datetime),
          end_datetime: toDateTimeLocalValue(existingEvent.end_datetime),
          venue_id: existingEvent.venue_id || '',
          base_price_per_seat: existingEvent.base_price_per_seat?.toString() || '',
          max_seats: existingEvent.max_seats?.toString() || '',
          seats_available: existingEvent.seats_available?.toString() || '',
          main_image_url: existingEvent.main_image_url || '',
          is_published: existingEvent.is_published || false,
          is_archived: existingEvent.is_archived || false,
          recurrence_type: recurrence?.type || '',
          recurrence_end_date: recurrence?.end_date ? recurrence.end_date.slice(0, 10) : '',
          recurrence_count: recurrence?.count?.toString() || '',
        });

        if (existingEvent.main_image_url) {
          setUploadedImages([existingEvent.main_image_url]);
        }
      });
    }
  }, [existingEvent]);

  useEffect(() => {
    if (!isNew || !assistantDraft || initializedRef.current) return;

    initializedRef.current = true;
    const title = assistantDraft.title || '';
    const maxSeats = assistantDraft.max_seats?.toString() || '20';

    queueMicrotask(() => {
      setFormData(prev => ({
        ...prev,
        title,
        slug: title ? slugify(title) : prev.slug,
        description: assistantDraft.description || prev.description,
        start_datetime: toDateTimeLocalValue(assistantDraft.start_datetime) || prev.start_datetime,
        base_price_per_seat: assistantDraft.base_price_per_seat?.toString() || prev.base_price_per_seat,
        max_seats: maxSeats,
        seats_available: maxSeats,
        is_published: false,
      }));
      showToast('Draft filled from Ask Easel. Review before saving.');
    });
  }, [assistantDraft, isNew, showToast]);

  const handleTitleChange = (title: string) => {
    if (isNew || !formData.slug) {
      setFormData(prev => ({
        ...prev,
        title,
        slug: slugify(title)
      }));
    } else {
      setFormData(prev => ({ ...prev, title }));
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setUploadedImages(prev => [...prev, result]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const setMainImage = (index: number) => {
    const newImages = [...uploadedImages];
    const mainImage = newImages.splice(index, 1)[0];
    newImages.unshift(mainImage);
    setUploadedImages(newImages);
  };

  const handleGenerateContent = () => {
    const content = `<h2>Welcome to ${formData.title}!</h2>

<p>Join us for an unforgettable evening of creativity and fun! Whether you're a beginner or an experienced artist, this event is designed for everyone to enjoy.</p>

<h3>What to Expect</h3>
<ul>
<li>Professional instruction from our talented artists</li>
<li>All painting supplies provided</li>
<li>Delicious wine and refreshments</li>
<li>A relaxed and fun atmosphere</li>
<li>Take home your own unique masterpiece!</li>
</ul>

<h3>Event Details</h3>
<p>No experience necessary - just bring your enthusiasm and creativity! We'll guide you step-by-step through creating your own beautiful painting. Feel free to bring snacks and your favorite beverages.</p>

<h3>Perfect For</h3>
<ul>
<li>Date nights</li>
<li>Birthday parties</li>
<li>Team building events</li>
<li>Girls' night out</li>
<li>Family fun</li>
</ul>

<p>Don't miss out on this amazing experience! Reserve your spot today and get ready to paint, sip, and smile.</p>`;
    
    setFormData(prev => ({ ...prev, description: content }));
    showToast('Description generated!');
  };

  const handleGenerateHeadlines = () => {
    setShowHeadlineIdeas(true);
  };

  const publishReadiness = useMemo(() => {
    const price = Number(formData.base_price_per_seat || 0);
    const capacity = Number(formData.max_seats || 0);
    const hasAssignedStaff = assignments.some((assignment) => assignment.status !== 'declined');
    const checks: ReadinessCheck[] = [
      {
        label: 'Event basics',
        detail: formData.title.trim() && formData.start_datetime ? 'Title and start time are set.' : 'Add a title and start date/time before publishing.',
        level: formData.title.trim() && formData.start_datetime ? 'ready' : 'blocked',
        required: true,
      },
      {
        label: 'Guest price',
        detail: price > 0 ? `${formatCurrency(price)} per seat is visible at checkout.` : 'Set a seat price so the guest total is clear.',
        level: price > 0 ? 'ready' : 'blocked',
        required: true,
      },
      {
        label: 'Capacity',
        detail: capacity > 0 ? `${capacity} seats available for booking.` : 'Set max seats so the event cannot oversell.',
        level: capacity > 0 ? 'ready' : 'blocked',
        required: true,
      },
      {
        label: 'Venue',
        detail: formData.venue_id ? 'Venue is selected.' : 'Choose a venue so customers know where to go.',
        level: formData.venue_id ? 'ready' : 'blocked',
        required: true,
      },
      {
        label: 'Public image',
        detail: uploadedImages[0] ? 'Main event image is set.' : 'Add a main image to help the event convert.',
        level: uploadedImages[0] ? 'ready' : 'warning',
      },
      {
        label: 'Instructor/staff',
        detail: isNew ? 'Assign staff after saving the event.' : hasAssignedStaff ? 'At least one staff member is assigned.' : 'No staff assigned yet.',
        level: isNew || hasAssignedStaff ? 'ready' : 'warning',
      },
      {
        label: 'Payment provider',
        detail: 'Local demo creates pending reservations when card processing is not connected.',
        level: 'warning',
      },
      {
        label: 'Confirmation email',
        detail: 'Email Center templates exist, but production sending depends on backend provider setup.',
        level: 'warning',
      },
    ];
    const blockedRequired = checks.filter((check) => check.required && check.level === 'blocked');
    const warnings = checks.filter((check) => check.level === 'warning');
    return {
      checks,
      blockedRequired,
      warnings,
      score: Math.round((checks.filter((check) => check.level === 'ready').length / checks.length) * 100),
    };
  }, [assignments, formData.base_price_per_seat, formData.max_seats, formData.start_datetime, formData.title, formData.venue_id, isNew, uploadedImages]);

  const pricePreview = useMemo(() => {
    const seats = Math.max(1, Number(pricingPreview.seats || 1));
    const seatPrice = Math.max(0, Number(formData.base_price_per_seat || 0));
    const addOns = Math.max(0, Number(pricingPreview.addOns || 0));
    const taxRate = Math.max(0, Number(pricingPreview.taxRate || 0)) / 100;
    const processingPercent = Math.max(0, Number(pricingPreview.processingPercent || 0)) / 100;
    const processingFixed = Math.max(0, Number(pricingPreview.processingFixed || 0));
    const seatSubtotal = seatPrice * seats;
    const subtotal = seatSubtotal + addOns;
    const tax = subtotal * taxRate;
    const guestTotal = subtotal + tax;
    const processingFee = guestTotal * processingPercent + processingFixed;
    const ownerNet = guestTotal - processingFee;
    return {
      seats,
      seatPrice,
      seatSubtotal,
      addOns,
      tax,
      guestTotal,
      processingFee,
      ownerNet,
    };
  }, [formData.base_price_per_seat, pricingPreview]);

  const configuredAddOnRevenue = useMemo(
    () => enabledAddOns.reduce((sum, addOn) => sum + addOn.price * (addOn.perSeat ? Number(pricingPreview.seats || 1) : 1), 0),
    [enabledAddOns, pricingPreview.seats]
  );

  const applyHeadline = (headline: string) => {
    setFormData(prev => ({ ...prev, title: headline, slug: slugify(headline) }));
    setShowHeadlineIdeas(false);
    showToast('Title applied!');
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showToast('Please enter an event title', 'error');
      return;
    }
    if (!formData.start_datetime) {
      showToast('Please enter a start date and time', 'error');
      return;
    }
    if (formData.is_published && publishReadiness.blockedRequired.length > 0) {
      showToast(`Before publishing: ${publishReadiness.blockedRequired.map((check) => check.label).join(', ')}`, 'error');
      return;
    }

    const eventData = {
      title: formData.title,
      slug: formData.slug,
      description: formData.description || null,
      start_datetime: new Date(formData.start_datetime).toISOString(),
      end_datetime: formData.end_datetime ? new Date(formData.end_datetime).toISOString() : null,
      venue_id: formData.venue_id || null,
      base_price_per_seat: formData.base_price_per_seat ? parseFloat(formData.base_price_per_seat) : null,
      max_seats: formData.max_seats ? parseInt(formData.max_seats) : null,
      seats_available: formData.seats_available ? parseInt(formData.seats_available) : null,
      main_image_url: uploadedImages[0] || null,
      is_published: formData.is_published,
      recurrence: formData.recurrence_type ? {
        type: formData.recurrence_type,
        end_date: formData.recurrence_end_date ? new Date(formData.recurrence_end_date + 'T23:59:59').toISOString() : null,
        count: formData.recurrence_count ? parseInt(formData.recurrence_count) : null,
      } : null,
    };

    try {
      if (id === 'new' && formData.recurrence_type) {
        await generateRecurringEvents(eventData);
      } else if (id === 'new') {
        await createEvent.mutateAsync(eventData);
      } else {
        await updateEvent.mutateAsync({ id: id!, ...eventData });
      }
      navigate('/admin/events');
    } catch (err: unknown) {
      console.error('Failed to save event:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save event', 'error');
    }
  };

  if (!isNew && eventsLoading) {
    return <LoadingSpinner />;
  }

  if (!isNew && !existingEvent && allEvents) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Event not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/admin/events')}>
          Back to Events
        </Button>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/events')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{isNew ? 'Create New Event' : 'Edit Event'}</h1>
        {!isNew && existingEvent && (
          <Button variant="outline" size="sm" onClick={() => setShowReschedule(true)} className="ml-0">
            <CalendarClock className="h-4 w-4 mr-1" />
            Reschedule
          </Button>
        )}
      </div>

      {!isNew && existingEvent && (
        <RescheduleModal
          isOpen={showReschedule}
          onClose={() => setShowReschedule(false)}
          event={existingEvent}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-lg p-1 w-fit" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'details'
              ? 'shadow-sm'
              : 'hover:opacity-80'
          }`}
          style={{
            backgroundColor: activeTab === 'details' ? 'var(--card-bg)' : 'transparent',
            color: activeTab === 'details' ? 'var(--primary-color)' : 'var(--text-muted)'
          }}
        >
          Event Details
        </button>
        {!isNew && (
          <>
            <button
              onClick={() => setActiveTab('command')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors`}
              style={{
                backgroundColor: activeTab === 'command' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'command' ? 'var(--primary-color)' : 'var(--text-muted)'
              }}
            >
              <ShieldCheck className="h-4 w-4 inline mr-1" />
              Command Center
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors`}
              style={{
                backgroundColor: activeTab === 'sales' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'sales' ? 'var(--primary-color)' : 'var(--text-muted)'
              }}
            >
              Sales
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors`}
              style={{
                backgroundColor: activeTab === 'staff' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'staff' ? 'var(--primary-color)' : 'var(--text-muted)'
              }}
            >
              <Users className="h-4 w-4 inline mr-1" />
              Staff
            </button>
            <button
              onClick={() => setActiveTab('broadcast')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors`}
              style={{
                backgroundColor: activeTab === 'broadcast' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'broadcast' ? 'var(--primary-color)' : 'var(--text-muted)'
              }}
            >
              <Mail className="h-4 w-4 inline mr-1" />
              Email Broadcasts
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors`}
              style={{
                backgroundColor: activeTab === 'sent' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'sent' ? 'var(--primary-color)' : 'var(--text-muted)'
              }}
            >
              <MailOpen className="h-4 w-4 inline mr-1" />
              Emails Sent
            </button>
          </>
        )}
      </div>

      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Event Title</label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Event title"
                      className="flex-1"
                    />
                    <Button variant="secondary" size="sm" onClick={handleGenerateHeadlines} title="AI Title Ideas">
                      <Lightbulb className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Input
                  label="Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="event-slug"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Description</label>
                  <Button variant="secondary" size="sm" onClick={handleGenerateContent}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Auto Write
                  </Button>
                </div>
                <Textarea
                  value={formData.description}
                  onChange={(event) => setFormData(prev => ({ ...prev, description: event.target.value }))}
                  rows={14}
                  placeholder="Describe the event. Basic HTML is supported."
                />
              </div>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card>
            <CardHeader>
              <CardTitle>Date & Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Start Date & Time"
                  type="datetime-local"
                  value={formData.start_datetime}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_datetime: e.target.value }))}
                />
                <Input
                  label="End Date & Time"
                  type="datetime-local"
                  value={formData.end_datetime}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_datetime: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recurring Events */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary-500" />
                <CardTitle>Recurring Event</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select
                  label="Repeat"
                  options={[
                    { value: '', label: 'Does not repeat' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: 'Every 2 weeks' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  value={formData.recurrence_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, recurrence_type: e.target.value }))}
                />
                {formData.recurrence_type && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary-50 rounded-lg">
                    <Input
                      label="End Date"
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, recurrence_end_date: e.target.value }))}
                      placeholder="When should the recurrence end?"
                    />
                    <Input
                      label="Max Occurrences"
                      type="number"
                      value={formData.recurrence_count}
                      onChange={(e) => setFormData(prev => ({ ...prev, recurrence_count: e.target.value }))}
                      placeholder="10"
                    />
                    <p className="text-sm col-span-full" style={{ color: 'var(--text-muted)' }}>
                      Events will be created based on the first date. Each occurrence will have the same details.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Venue & Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Venue & Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Venue"
                  options={[
                    { value: '', label: 'Select a venue' },
                    ...(venues?.map((v) => ({ value: v.id, label: v.name })) || []),
                  ]}
                  value={formData.venue_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, venue_id: e.target.value }))}
                />
                <Input
                  label="Price per Seat ($)"
                  type="number"
                  value={formData.base_price_per_seat}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_price_per_seat: e.target.value }))}
                  placeholder="35"
                />
                <Input
                  label="Max Seats"
                  type="number"
                  value={formData.max_seats}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_seats: e.target.value, seats_available: e.target.value }))}
                  placeholder="20"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event Add-Ons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Add-ons are demo-configured from active shop products and appear in checkout for this event slug. Production should store these in an event add-ons table.
              </div>
              {!eventAddOnSlug && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Add a title or slug before configuring checkout add-ons.
                </div>
              )}
              {products.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active products found. Add products in Shop first.</p>
              ) : (
                <div className="space-y-3">
                  {eventAddOns.map((addOn) => {
                    const lowStock = addOn.enabled && addOn.stock > 0 && addOn.maxQuantity > addOn.stock;
                    return (
                      <div key={addOn.productId} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_110px_120px_130px] lg:items-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={addOn.enabled}
                            disabled={!eventAddOnSlug}
                            onChange={(e) => updateAddOn(addOn.productId, { enabled: e.target.checked })}
                          />
                          <span>
                            <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>{addOn.name}</span>
                            <span className="block text-sm" style={{ color: 'var(--text-muted)' }}>
                              Stock {addOn.stock} · Shop price {formatCurrency(products.find((product) => product.id === addOn.productId)?.price || addOn.price)}
                            </span>
                            {lowStock && (
                              <span className="mt-1 block text-xs" style={{ color: '#dc2626' }}>
                                Max quantity is higher than current inventory.
                              </span>
                            )}
                          </span>
                        </label>
                        <Input
                          label="Price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(addOn.price)}
                          onChange={(e) => updateAddOn(addOn.productId, { price: Number(e.target.value || 0) })}
                        />
                        <Input
                          label="Max Qty"
                          type="number"
                          min="1"
                          value={String(addOn.maxQuantity)}
                          onChange={(e) => updateAddOn(addOn.productId, { maxQuantity: Math.max(1, Number(e.target.value || 1)) })}
                        />
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={addOn.perSeat}
                            onChange={(e) => updateAddOn(addOn.productId, { perSeat: e.target.checked })}
                          />
                          One per seat
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Enabled add-ons</p>
                  <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{enabledAddOns.length}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preview add-on revenue</p>
                  <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(configuredAddOnRevenue)}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Inventory warnings</p>
                  <p className="text-xl font-bold" style={{ color: enabledAddOns.some((addOn) => addOn.stock > 0 && addOn.maxQuantity > addOn.stock) ? '#dc2626' : '#16a34a' }}>
                    {enabledAddOns.filter((addOn) => addOn.stock > 0 && addOn.maxQuantity > addOn.stock).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                  <CardTitle>Guest Total Preview</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Preview Seats"
                    type="number"
                    min="1"
                    value={pricingPreview.seats}
                    onChange={(e) => setPricingPreview((prev) => ({ ...prev, seats: e.target.value }))}
                  />
                  <Input
                    label="Optional Add-Ons ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingPreview.addOns}
                    onChange={(e) => setPricingPreview((prev) => ({ ...prev, addOns: e.target.value }))}
                  />
                  <Input
                    label="Tax Rate (%)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingPreview.taxRate}
                    onChange={(e) => setPricingPreview((prev) => ({ ...prev, taxRate: e.target.value }))}
                  />
                  <Input
                    label="Processing %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingPreview.processingPercent}
                    onChange={(e) => setPricingPreview((prev) => ({ ...prev, processingPercent: e.target.value }))}
                  />
                  <Input
                    label="Fixed Processing ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingPreview.processingFixed}
                    onChange={(e) => setPricingPreview((prev) => ({ ...prev, processingFixed: e.target.value }))}
                  />
                </div>

                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span style={{ color: 'var(--text-secondary)' }}>{pricePreview.seats} seat{pricePreview.seats === 1 ? '' : 's'} × {formatCurrency(pricePreview.seatPrice)}</span>
                      <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricePreview.seatSubtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: 'var(--text-secondary)' }}>Optional add-ons</span>
                      <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricePreview.addOns)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: 'var(--text-secondary)' }}>Estimated taxes</span>
                      <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricePreview.tax)}</span>
                    </div>
                    <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="flex justify-between gap-4 text-base font-bold">
                        <span style={{ color: 'var(--text-primary)' }}>Customer total</span>
                        <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(pricePreview.guestTotal)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: 'var(--text-secondary)' }}>Estimated processing cost</span>
                      <span style={{ color: 'var(--text-primary)' }}>-{formatCurrency(pricePreview.processingFee)}</span>
                    </div>
                    <div className="flex justify-between gap-4 font-semibold">
                      <span style={{ color: 'var(--text-primary)' }}>Estimated owner net</span>
                      <span style={{ color: '#16a34a' }}>{formatCurrency(pricePreview.ownerNet)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This preview is owner-facing only. It does not add an Easel booking fee or change checkout until tax, fee, and add-on settings are wired to the backend.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                    <CardTitle>Publish Readiness</CardTitle>
                  </div>
                  <Badge variant={publishReadiness.blockedRequired.length ? 'danger' : publishReadiness.warnings.length ? 'warning' : 'success'}>
                    {publishReadiness.score}% ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {publishReadiness.checks.map((check) => (
                    <div key={check.label} className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                      {check.level === 'ready' ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#16a34a' }} />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: check.level === 'blocked' ? '#dc2626' : '#d97706' }} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{check.label}</p>
                          {check.required && <Badge variant={check.level === 'blocked' ? 'danger' : 'gray'}>Required</Badge>}
                        </div>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {publishReadiness.blockedRequired.length > 0 && (
                  <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>
                    Publishing is blocked until required items are fixed. You can still save the event as a draft.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Event Images</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary-500' : ''
                }`}
                style={{ borderColor: isDragging ? 'var(--primary-color)' : 'var(--border-color)' }}
              >
                <Upload className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-muted)' }} />
                <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Drag and drop images here, or click to upload
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="opacity-0 absolute z-10 w-32 h-12 cursor-pointer"
                  id="image-upload"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <Button variant="secondary" type="button" className="relative">
                  Browse Files
                </Button>
                <span className="ml-3" style={{ color: 'var(--text-muted)' }}>Select images</span>
              </div>

              {/* Image Grid */}
              {uploadedImages.length > 0 && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Event image ${index + 1}`}
                        className={`w-full h-32 object-cover rounded-lg ${index === 0 ? 'ring-2 ring-primary-500' : ''}`}
                      />
                      <div className="absolute top-2 left-2">
                        {index === 0 && (
                          <span className="bg-primary-500 text-white text-xs px-2 py-1 rounded">
                            Main
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {index !== 0 && (
                          <button
                            onClick={() => setMainImage(index)}
                            className="p-1 rounded-full shadow" style={{ backgroundColor: 'var(--card-bg)' }}
                            title="Set as main"
                          >
                            <ImageIcon className="h-4 w-4 style={{ color: 'var(--text-secondary)' }}" />
                          </button>
                        )}
                        <button
                          onClick={() => removeImage(index)}
                          className="p-1 rounded-full shadow" style={{ backgroundColor: 'var(--card-bg)' }}
                          title="Remove"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

{/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                    className="rounded"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>Published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_archived}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_archived: e.target.checked }))}
                    className="rounded"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>Archived</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/events')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateEvent.isPending || createEvent.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isNew ? 'Create Event' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'command' && existingEvent && (
        <CommandCenterTab
          event={existingEvent}
          assignments={assignments as EventAssignment[]}
          readiness={publishReadiness}
          addOns={enabledAddOns}
          onOpenTab={setActiveTab}
        />
      )}

      {activeTab === 'sales' && existingEvent && (
        <SalesTab eventId={existingEvent.id} eventTitle={existingEvent.title} />
      )}

      {activeTab === 'staff' && existingEvent && (
        <StaffTab eventId={existingEvent.id} />
      )}

      {activeTab === 'broadcast' && existingEvent && (
        <EmailBroadcastsTab eventId={existingEvent.id} />
      )}

      {activeTab === 'sent' && existingEvent && (
        <EmailsSentTab eventId={existingEvent.id} eventTitle={existingEvent.title} />
      )}

      {showHeadlineIdeas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 max-w-md w-full mx-4" style={{ backgroundColor: 'var(--card-bg)' }}>
            <h3 className="text-lg font-semibold mb-4">AI Title Ideas</h3>
            <div className="space-y-2">
              {[
                `Join Us for ${formData.title || 'Painting Event'} - Fun & Creative Evening`,
                `${formData.title || 'Painting Event'}: Paint, Sip, and Create Memories`,
                `Experience ${formData.title || 'Painting Event'} - Perfect Night Out`,
                `${formData.title || 'Painting Event'} - Unleash Your Creativity`,
                `Discover the Joy of ${formData.title || 'Painting Event'}`,
              ].map((headline, idx) => (
                <button
                  key={idx}
                  onClick={() => applyHeadline(headline)}
                  className="w-full text-left p-3 rounded-lg border hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  {headline}
                </button>
              ))}
            </div>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => setShowHeadlineIdeas(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
