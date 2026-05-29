import { Link, useOutletContext } from 'react-router-dom';
import { useDashboardStats, useDashboardPreferences, useUpdateDashboardPreferences, DASHBOARD_WIDGETS, WidgetId, DashboardPreferences, DateRange } from '../../hooks/useAdmin';
import { usePrivateEventRequests } from '../../hooks/usePrivateEventRequests';
import { usePayRecords } from '../../hooks/usePayRecords';
import { useEventAssignments } from '../../hooks/useEventAssignments';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Calendar, DollarSign, Users, Tag, TrendingUp, TrendingDown, Check, X, XCircle, BarChart3, AlertTriangle, Plus, Mail, Percent, RefreshCw, UsersRound, GripVertical, SlidersHorizontal, ArrowRight, Clock, Sparkles, CheckCircle2, Search, MoreVertical, Gift, ShoppingCart, Grid2X2, UserCircle, Palette, ChevronDown, Package, Building2, ShieldCheck, Database, ServerCog, CreditCard } from 'lucide-react';
import LaunchChecklistWidget from '../../components/dashboard/LaunchChecklistWidget';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useOwnerActionFeed } from '../../hooks/useOwnerActionFeed';
import { useProductionReadiness } from '../../hooks/useProductionReadiness';
import type { EventAssignment, PayRecord, PrivateEventRequest } from '../../types/database';

const COLORS = ['#eb6a3d', '#f08b67', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24', '#34d399'];

const SPAN_MAP: Record<WidgetId, number> = {
  'revenue': 3, 'seats-sold': 3, 'avg-ticket': 3, 'repeat-rate': 3,
  'sales-chart': 8, 'recent-sales': 4, 'upcoming-events': 6,
  'low-inventory': 3, 'gift-card': 3, 'coupon-usage': 3,
  'active-coupons': 3, 'churn-risk': 3, 'email-subscribers': 3,
  'analytics-summary': 4, 'email-campaigns': 4,
  'action-items': 4, 'quick-actions': 4, 'top-events': 4, 'venue-util': 4,
};

const SPAN_CLASSES: Record<number, string> = {
  3: 'col-span-12 sm:col-span-6 lg:col-span-3',
  4: 'col-span-12 sm:col-span-6 lg:col-span-4',
  6: 'col-span-12 lg:col-span-6',
  8: 'col-span-12 lg:col-span-8',
};

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d': 'prior 7 days',
  '30d': 'prior 30 days',
  '90d': 'prior 90 days',
  'custom': 'prior period',
};

function ChangeIndicator({ value, dateRange }: { value: number; dateRange?: DateRange }) {
  if (value === 0) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
  const isPositive = value > 0;
  return (
    <span className="flex items-center gap-1">
      <span className={`text-xs font-medium flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </span>
      {dateRange && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>vs {DATE_RANGE_LABELS[dateRange]}</span>}
    </span>
  );
}

const DEFAULT_LAYOUT: WidgetId[] = ['revenue', 'seats-sold', 'avg-ticket', 'repeat-rate', 'sales-chart', 'recent-sales', 'upcoming-events', 'analytics-summary', 'email-campaigns', 'low-inventory', 'gift-card'];
const FALLBACK_EVENT_DATETIME = '1970-01-01T00:00:00';
const FIXED_BRIEFING_WIDGETS: WidgetId[] = ['upcoming-events', 'revenue', 'seats-sold', 'repeat-rate', 'gift-card'];
const OPTIONAL_WIDGET_IDS = DASHBOARD_WIDGETS.map(widget => widget.id).filter(id => !FIXED_BRIEFING_WIDGETS.includes(id));
const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'custom', label: 'Custom' },
];

const getDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type DashboardEventRow = {
  id: string;
  title: string;
  start_datetime?: string;
  max_seats: number | null;
  seats_available: number | null;
  fillRate?: number;
  main_image_url?: string | null;
  event_type?: string | null;
  venue?: { name?: string | null } | null;
};

type DashboardOrderRow = {
  event?: { title?: string | null } | null;
  purchaser_name?: string | null;
  total_seats?: number | null;
  total_amount?: number | null;
  created_at: string;
};

type DashboardActionItem = {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'success';
};

type DashboardTopEvent = {
  id: string;
  title: string;
  revenue: number;
};

export default function DashboardPage() {
  const { openAssistant } = useOutletContext<{ openAssistant?: () => void }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [customDateFrom, setCustomDateFrom] = useState(() => getDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [customDateTo, setCustomDateTo] = useState(() => getDateInputValue(new Date()));
  const [showConfig, setShowConfig] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(DEFAULT_LAYOUT);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'seats' | 'orders'>('revenue');
  const [draggedId, setDraggedId] = useState<WidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<WidgetId | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const dragCounter = useRef(0);

  const { data: stats, isLoading } = useDashboardStats(dateRange, customDateFrom, customDateTo);
  const { data: prefs, isLoading: prefsLoading } = useDashboardPreferences(user?.id);
  const { data: privateRequests = [] } = usePrivateEventRequests();
  const { data: payRecords = [] } = usePayRecords();
  const { data: assignments = [] } = useEventAssignments();
  const ownerActionFeed = useOwnerActionFeed();
  const updatePrefs = useUpdateDashboardPreferences();
  const readiness = useProductionReadiness();

  useEffect(() => {
    if (prefs?.widgets?.length) {
      queueMicrotask(() => {
        setActiveWidgets(prefs.widgets);
        setDateRange(prefs.dateRange || '30d');
        if (prefs.customDateFrom) setCustomDateFrom(prefs.customDateFrom);
        if (prefs.customDateTo) setCustomDateTo(prefs.customDateTo);
      });
    }
  }, [prefs]);

  const savePreferences = async () => {
    if (!user?.id) return;
    const newPrefs: DashboardPreferences = { userId: user.id, widgets: activeWidgets, dateRange, customDateFrom, customDateTo };
    await updatePrefs.mutateAsync(newPrefs);
    showToast('Dashboard preferences saved');
    setShowConfig(false);
  };

  const toggleWidget = (id: WidgetId) => {
    setActiveWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  const handleDragStart = (e: React.DragEvent, id: WidgetId) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragOverId(null);

    const sourceId = draggedId || (e.dataTransfer.getData('text/plain') as WidgetId);
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      return;
    }

    setActiveWidgets(prev => {
      const newWidgets = [...prev];
      const fromIndex = newWidgets.indexOf(sourceId);
      const toIndex = newWidgets.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      newWidgets.splice(fromIndex, 1);
      newWidgets.splice(toIndex, 0, sourceId);
      return newWidgets;
    });
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current = 0;
  };

  const chartData = (stats?.salesByWeek || []).map(d => ({
    ...d,
    label: d.week,
    value: chartMetric === 'revenue' ? d.revenue : chartMetric === 'seats' ? d.seats : d.orders,
  }));

  const rangeLabel = dateRange === 'custom'
    ? `${new Date(`${customDateFrom}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${customDateTo}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : dateRange === '7d'
      ? 'Last 7 days'
      : dateRange === '90d'
        ? 'Last 90 days'
        : 'Last 30 days';

  const comparisonLabel = dateRange === 'custom' ? 'vs prior custom period' : `vs ${DATE_RANGE_LABELS[dateRange]}`;

  const getMiniBars = (metric: 'revenue' | 'seats' | 'orders') => {
    const values = (stats?.salesByWeek || []).map((week) => Number(week[metric] || 0));
    const fallback = [8, 12, 10, 15, 13, 18];
    if (!values.length || values.every((value) => value === 0)) return fallback;
    const max = Math.max(...values, 1);
    return values.map((value) => Math.max(8, Math.round((value / max) * 24)));
  };

  const assignmentEventIds = useMemo(
    () => new Set((assignments as EventAssignment[]).filter((assignment) => assignment.status !== 'declined').map((assignment) => assignment.event_id)),
    [assignments]
  );
  const upcomingEvents = (stats?.upcomingEvents || []) as DashboardEventRow[];
  const lowFillEvents = upcomingEvents.filter((event) => (event.fillRate || 0) < 35);
  const missingStaffEvents = upcomingEvents.filter((event) => !assignmentEventIds.has(event.id));
  const submittedPrivateRequests = (privateRequests as PrivateEventRequest[]).filter((request) => request.status === 'submitted');
  const payableRecords = (payRecords as PayRecord[]).filter((record) => ['pending', 'approved', 'failed'].includes(record.status));
  const activeOptionalWidgets = activeWidgets.filter(id => OPTIONAL_WIDGET_IDS.includes(id));


  const getEventNextStep = (event: DashboardEventRow) => {
    if (!assignmentEventIds.has(event.id)) return { label: 'Assign staff', to: `/admin/assignments?eventId=${event.id}&action=assign`, tone: 'amber' };
    if ((event.fillRate || 0) < 35) return { label: 'Promote', to: '/admin/email', tone: 'red' };
    return { label: 'View', to: `/admin/events/${event.id}`, tone: 'neutral' };
  };

  const nextBestActions = ownerActionFeed.filter(item => item.urgent || item.type !== 'order').slice(0, 3);
  const recentActivity = ownerActionFeed.slice(0, 5);

  const priorityCards = [
    {
      title: 'Events Need Attention',
      value: lowFillEvents.length + missingStaffEvents.length,
      description: lowFillEvents.length ? `${lowFillEvents.length} low fill` : missingStaffEvents.length ? `${missingStaffEvents.length} missing staff` : 'Schedule looks steady',
      icon: AlertTriangle,
      to: lowFillEvents.length ? '/admin/events' : '/admin/assignments',
      cta: lowFillEvents.length || missingStaffEvents.length ? 'Review events' : 'View calendar',
      tone: lowFillEvents.length || missingStaffEvents.length ? 'amber' : 'green',
    },
    {
      title: 'Private Requests',
      value: submittedPrivateRequests.length,
      description: submittedPrivateRequests.length ? 'Awaiting follow-up' : 'No new leads',
      icon: Mail,
      to: '/admin/private-requests',
      cta: 'Open pipeline',
      tone: submittedPrivateRequests.length ? 'orange' : 'green',
    },
    {
      title: 'Payroll',
      value: payableRecords.length,
      description: payableRecords.length ? 'Items need review' : 'Nothing pending',
      icon: Clock,
      to: '/admin/pay-queue',
      cta: 'Review pay',
      tone: payableRecords.length ? 'amber' : 'green',
    },
  ];

  const quickCreateItems = [
    { label: 'Event', description: 'Schedule a public or private class', to: '/admin/events/new', icon: Calendar },
    { label: 'Coupon', description: 'Create a promotion code', to: '/admin/coupons', icon: Tag },
    { label: 'Employee', description: 'Add staff or instructor', to: '/admin/employees/new', icon: Users },
    { label: 'Product', description: 'Add shop inventory', to: '/admin/products', icon: Package },
    { label: 'Private Request', description: 'Review inbound event leads', to: '/admin/private-requests', icon: Mail },
    { label: 'Corporate Account', description: 'Start a business account', to: '/admin/corporate-accounts/new', icon: Building2 },
  ];

  const renderWidget = (widgetId: WidgetId) => {
    const span = SPAN_MAP[widgetId];
    const isDragging = draggedId === widgetId;
    const isDragOver = dragOverId === widgetId;
    const colClass = SPAN_CLASSES[span] || 'col-span-12';

    const wrapperProps = {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, widgetId),
      onDragEnter: (e: React.DragEvent) => handleDragEnter(e, widgetId),
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: (e: React.DragEvent) => handleDrop(e, widgetId),
      onDragEnd: handleDragEnd,
      className: `${colClass} transition-all duration-200 ${isDragging ? 'opacity-40 scale-95' : ''} ${isDragOver ? 'ring-2 ring-primary-500 ring-offset-2 rounded-lg' : ''}`,
    };

    switch (widgetId) {
      case 'revenue':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Revenue</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatCurrency(stats?.revenue?.value || 0)}</p>
                    <ChangeIndicator value={stats?.revenue?.change || 0} dateRange={dateRange} />
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><DollarSign className="h-5 w-5 text-green-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'seats-sold':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Seats Sold</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{stats?.seatsSold?.value || 0}</p>
                    <ChangeIndicator value={stats?.seatsSold?.change || 0} dateRange={dateRange} />
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><Users className="h-5 w-5 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'avg-ticket':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Avg Ticket Value</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatCurrency(stats?.avgTicketValue || 0)}</p>
                    <ChangeIndicator value={stats?.avgTicketChange || 0} dateRange={dateRange} />
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><Tag className="h-5 w-5 text-orange-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'repeat-rate':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Repeat Customer Rate</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{(stats?.repeatRate || 0).toFixed(1)}%</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stats?.repeatCustomers || 0} returning · {stats?.newCustomers || 0} new</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><RefreshCw className="h-5 w-5 text-purple-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'coupon-usage':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Coupon Usage Rate</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{(stats?.couponUsageRate || 0).toFixed(1)}%</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><Percent className="h-5 w-5 text-cyan-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'active-coupons':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Active Coupons</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{stats?.activeCouponsCount || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><Tag className="h-5 w-5 text-pink-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'churn-risk':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Churn Risk</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{stats?.churnRiskCount || 0}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Regulars inactive 60+ days</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><UsersRound className="h-5 w-5 text-red-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'email-subscribers':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>New Subscribers</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>+{stats?.newSubscribers || 0}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stats?.totalSubscribers || 0} total</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><Mail className="h-5 w-5 text-indigo-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-chart':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} />
                  <CardTitle className="text-base">Sales Chart</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(['revenue', 'seats', 'orders'] as const).map(metric => (
                    <button key={metric} onClick={() => setChartMetric(metric)} className="px-2 py-1 text-xs rounded-md transition-colors"
                      style={{ backgroundColor: chartMetric === metric ? 'var(--primary)' : 'transparent', color: chartMetric === metric ? 'white' : 'var(--text-primary)' }}>
                      {metric.charAt(0).toUpperCase() + metric.slice(1)}
                    </button>
                  ))}
                  <button onClick={() => toggleWidget('sales-chart')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 min-h-px min-w-px">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 256 }}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis fontSize={12} tick={{ fill: 'var(--text-muted)' }} tickFormatter={chartMetric === 'revenue' ? (v: number) => `$${v}` : undefined} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#eb6a3d" radius={[4, 4, 0, 0]} name={chartMetric} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'recent-sales':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} />
                  <CardTitle className="text-base">Recent Sales</CardTitle>
                </div>
                <button onClick={() => toggleWidget('recent-sales')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                {stats?.recentOrders?.length ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(stats.recentOrders as DashboardOrderRow[]).map((order, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{order.event?.title || 'Unknown Event'}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{order.purchaser_name} · {order.total_seats} seat{order.total_seats !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{formatCurrency(order.total_amount || 0)}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(order.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <ShoppingCart className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No sales in this period</p>
                    <Link to="/admin/events" className="mt-2 inline-flex text-xs font-semibold" style={{ color: 'var(--primary-color)' }}>Create an event to get started</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'upcoming-events':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Upcoming Events</CardTitle></div>
                <button onClick={() => toggleWidget('upcoming-events')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                {stats?.upcomingEvents?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <th className="text-left py-2 px-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Event</th>
                          <th className="text-left py-2 px-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                          <th className="text-left py-2 px-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Fill Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.upcomingEvents as DashboardEventRow[]).map((event) => {
                          const fillRate = event.fillRate || 0;
                          return (
                            <tr key={event.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                              <td className="py-3 px-4">
                                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.venue?.name || '-'}</p>
                              </td>
                              <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{event.start_datetime ? formatDateTime(event.start_datetime) : '-'}</td>
                              <td className="py-3 px-4">
                                <div className="w-20">
                                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                    <div className="h-full rounded-full" style={{
                                      width: `${fillRate}%`,
                                      backgroundColor: fillRate >= 80 ? '#ef4444' : fillRate >= 50 ? '#f59e0b' : '#22c55e'
                                    }} />
                                  </div>
                                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{fillRate}%</p>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Calendar className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming events</p>
                    <Link to="/admin/events/new" className="mt-2 inline-flex text-xs font-semibold" style={{ color: 'var(--primary-color)' }}>Schedule your first event</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'low-inventory':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Low Inventory Alerts</CardTitle></div>
                <button onClick={() => toggleWidget('low-inventory')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                {stats?.lowInventoryEvents?.length ? (
                  <div className="space-y-2">
                    {(stats.lowInventoryEvents as DashboardEventRow[]).map((event) => (
                      <div key={event.id} className="flex items-center gap-2 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.seats_available || 0} seats left</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium text-green-600">All events well stocked</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'gift-card':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Gift Card Liability</CardTitle></div>
                <button onClick={() => toggleWidget('gift-card')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(stats?.giftCardLiability || 0)}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Outstanding unredeemed value</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'action-items':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Action Items</CardTitle></div>
                <button onClick={() => toggleWidget('action-items')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                {stats?.actionItems?.length ? (
                  <div className="space-y-2">
                    {(stats.actionItems as DashboardActionItem[]).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${item.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`} />
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium text-green-600">All clear</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No action items need attention</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'quick-actions':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Quick Actions</CardTitle></div>
                <button onClick={() => toggleWidget('quick-actions')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/admin/events/new"><Button variant="outline" className="w-full justify-start"><Plus className="h-4 w-4 mr-2" /> Add Event</Button></Link>
                  <Link to="/admin/coupons"><Button variant="outline" className="w-full justify-start"><Tag className="h-4 w-4 mr-2" /> Create Coupon</Button></Link>
                  <Link to="/admin/email"><Button variant="outline" className="w-full justify-start"><Mail className="h-4 w-4 mr-2" /> Send Email</Button></Link>
                  <Link to="/admin/attendees"><Button variant="outline" className="w-full justify-start"><Users className="h-4 w-4 mr-2" /> Attendees</Button></Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'top-events':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Top Events by Revenue</CardTitle></div>
                <button onClick={() => toggleWidget('top-events')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                {stats?.topEventsByRevenue?.length ? (
                  <div className="space-y-2">
                    {(stats.topEventsByRevenue as DashboardTopEvent[]).map((event, idx) => (
                      <div key={event.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: COLORS[idx % COLORS.length], color: 'white' }}>{idx + 1}</span>
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{event.title}</span>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(event.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Calendar className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events with revenue yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'venue-util':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Venue Utilization</CardTitle></div>
                <button onClick={() => toggleWidget('venue-util')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                {stats?.venueUtilization?.length ? (
                  <div className="h-64 min-h-px min-w-px">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 256 }}>
                      <PieChart>
                        <Pie data={stats.venueUtilization} dataKey="fillRate" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}>
                          {stats.venueUtilization.map((_, idx: number) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Building2 className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No venue data for this period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'analytics-summary': {
        const pageViews = stats?.salesByWeek?.reduce((s, w) => s + (w.orders || 0), 0) || 0;
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Traffic Snapshot</CardTitle></div>
                <button onClick={() => toggleWidget('analytics-summary')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Page views</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats?.totalCustomers || 0}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Customers</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats?.totalCustomers || 0}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Orders</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{(stats?.salesByWeek || []).reduce((s, w) => s + (w.orders || 0), 0)}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Subscribers</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats?.totalSubscribers || 0}</p>
                    </div>
                  </div>
                  <Link to="/admin/analytics" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary-color)' }}>
                    View full analytics <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'email-campaigns':
        return (
          <div key={widgetId} {...wrapperProps}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 cursor-grab" style={{ color: 'var(--text-muted)' }} /><CardTitle className="text-base">Email Campaigns</CardTitle></div>
                <button onClick={() => toggleWidget('email-campaigns')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" style={{ color: 'var(--text-muted)' }}><XCircle className="h-4 w-4" /></button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Subscribers</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats?.totalSubscribers || 0}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>New (period)</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>+{stats?.newSubscribers || 0}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/admin/email"><Button variant="outline" size="sm"><Mail className="h-3 w-3 mr-1" /> Email Center</Button></Link>
                    <Link to="/admin/newsletter"><Button variant="outline" size="sm"><Users className="h-3 w-3 mr-1" /> Subscribers</Button></Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading || prefsLoading) return <LoadingSpinner />;

  return (
    <div className="owner-dashboard -m-4 space-y-6 bg-[#f7f8fb] p-4 text-slate-950 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1 xl:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-16 text-sm text-slate-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            placeholder="Search or type a command..."
            readOnly
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">⌘K</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setCreateMenuOpen((open) => !open)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Create <ChevronDown className={`h-4 w-4 transition-transform ${createMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {createMenuOpen && (
              <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-950">Create new</p>
                  <p className="text-xs text-slate-500">Start the most common owner workflows.</p>
                </div>
                <div className="p-2">
                  {quickCreateItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setCreateMenuOpen(false)}
                        className="flex items-start gap-3 rounded-lg px-3 py-3 transition hover:bg-slate-50"
                      >
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                          <span className="block text-xs text-slate-500">{item.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <SlidersHorizontal className="h-4 w-4" /> Customize widgets
          </button>
          <Link to="/admin/analytics" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <BarChart3 className="h-4 w-4" /> Analytics
          </Link>
          <Link to="/admin/email" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Mail className="h-4 w-4" /> Email
          </Link>
          <button type="button" onClick={openAssistant} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Sparkles className="h-4 w-4" /> Ask Easel
          </button>
          <div className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 pl-3">
            <UserCircle className="h-7 w-7 text-slate-400" />
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user?.name || 'Admin'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">Today</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Lake Tahoe Paint & Sip <span className="mx-2 text-orange-500">•</span>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {DATE_RANGE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setDateRange(opt.value)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${dateRange === opt.value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <input type="date" value={customDateFrom} max={customDateTo} onChange={(e) => setCustomDateFrom(e.target.value)} className="border-0 bg-transparent px-1 py-1 text-sm text-slate-700 focus:outline-none" />
              <span className="text-sm text-slate-400">to</span>
              <input type="date" value={customDateTo} min={customDateFrom} onChange={(e) => setCustomDateTo(e.target.value)} className="border-0 bg-transparent px-1 py-1 text-sm text-slate-700 focus:outline-none" />
            </div>
          )}
        </div>
      </div>

      {showConfig && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-950">Homepage Widgets</h2>
              <p className="mt-1 text-sm text-slate-500">Choose the optional panels that appear below the main briefing.</p>
            </div>
            <button onClick={() => setShowConfig(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {DASHBOARD_WIDGETS.filter(widget => OPTIONAL_WIDGET_IDS.includes(widget.id)).map(widget => (
              <button key={widget.id} onClick={() => toggleWidget(widget.id)} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700">
                <span>{widget.title}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded ${activeWidgets.includes(widget.id) ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {activeWidgets.includes(widget.id) && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setActiveWidgets(DEFAULT_LAYOUT)}>Reset</Button>
            <Button onClick={savePreferences} disabled={updatePrefs.isPending}>{updatePrefs.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {priorityCards.map((card, index) => {
          const Icon = index === 0 ? Calendar : index === 1 ? UsersRound : DollarSign;
          const tint = index === 0 ? 'orange' : index === 1 ? 'violet' : 'emerald';
          return (
            <Link key={card.title} to={card.to} className={`group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tint === 'orange' ? 'bg-orange-50/30' : tint === 'violet' ? 'bg-violet-50/30' : 'bg-emerald-50/30'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${tint === 'orange' ? 'bg-orange-100 text-orange-600' : tint === 'violet' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowRight className={`h-4 w-4 transition group-hover:translate-x-1 ${tint === 'orange' ? 'text-orange-500' : tint === 'violet' ? 'text-violet-500' : 'text-emerald-600'}`} />
              </div>
              <div className="mt-4 flex items-end gap-3">
                <span className={`text-3xl font-bold ${tint === 'orange' ? 'text-orange-600' : tint === 'violet' ? 'text-violet-600' : 'text-emerald-700'}`}>{card.value}</span>
                <div className="pb-1">
                  <p className="text-base font-bold text-slate-950">{card.title}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${card.tone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{card.description}</span>
                <span className={`text-sm font-semibold ${tint === 'orange' ? 'text-orange-600' : tint === 'violet' ? 'text-violet-600' : 'text-emerald-700'}`}>{card.cta}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-950">Upcoming Events This Week</h2>
            </div>
            <Link to="/admin/events" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Calendar className="h-4 w-4" /> View Calendar
            </Link>
          </div>
          {upcomingEvents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Fill</th>
                    <th className="px-4 py-3 text-left">Staff</th>
                    <th className="px-5 py-3 text-right">Next Step</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingEvents.slice(0, 5).map((event) => {
                    const nextStep = getEventNextStep(event);
                    const assignment = (assignments as EventAssignment[]).find((item) => item.event_id === event.id && item.status !== 'declined');
                    const start = new Date(event.start_datetime || FALLBACK_EVENT_DATETIME);
                    return (
                      <tr key={event.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {event.main_image_url ? (
                              <img src={event.main_image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 text-orange-500"><Palette className="h-5 w-5" /></div>
                            )}
                            <div>
                              <p className="font-bold text-slate-950">{event.title}</p>
                              <p className="text-xs text-slate-500">{event.event_type === 'private' ? 'Private Event' : 'Public Event'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">{start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                          <p>{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-bold text-slate-950">{event.fillRate || 0}%</p>
                          <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${event.fillRate || 0}%`, backgroundColor: (event.fillRate || 0) < 35 ? '#ef4444' : (event.fillRate || 0) < 70 ? '#f97316' : '#16a34a' }} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{Math.max(0, (event.max_seats || 0) - (event.seats_available || 0))} / {event.max_seats || 0} seats</p>
                        </td>
                        <td className="px-4 py-4">
                          {assignment ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{assignment.employee?.name?.slice(0, 1) || 'S'}</div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{assignment.employee?.name || 'Assigned'}</p>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Assigned</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"><Users className="h-4 w-4" /></div>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Needed</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={nextStep.to} className="inline-flex h-9 items-center rounded-lg border border-orange-200 px-4 text-sm font-semibold text-orange-600 hover:bg-orange-50">{nextStep.label}</Link>
                            <MoreVertical className="h-4 w-4 text-slate-300" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-5 py-3 text-center">
                <Link to="/admin/events" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600">View all events <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          ) : (
            <div className="py-14 text-center">
              <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-900">No upcoming events yet</p>
              <Link to="/admin/events/new" className="mt-4 inline-flex"><Button size="sm">Add Event</Button></Link>
            </div>
          )}
        </section>

        <aside className="col-span-12 space-y-5 xl:col-span-4">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <h2 className="font-bold text-slate-950">Launch Checklist</h2>
            </div>
            <LaunchChecklistWidget />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="font-bold text-slate-950">Next Best Actions</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {nextBestActions.length ? nextBestActions.map(action => (
                <Link key={action.id} to={action.to} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <span className="h-5 w-5 rounded-full border border-slate-200" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{action.summary}</span>
                    <span className="block truncate text-xs text-slate-500">{action.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </Link>
              )) : (
                <div className="flex items-start gap-3 p-5 text-emerald-700"><CheckCircle2 className="h-5 w-5" /><p className="text-sm font-semibold">You are caught up</p></div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Clock className="h-5 w-5 text-orange-500" />
              <h2 className="font-bold text-slate-950">Recent Activity</h2>
            </div>
            <div className="space-y-4 p-5">
              {recentActivity.length ? recentActivity.slice(0, 4).map((item, idx) => {
                const ActivityIcon = idx % 3 === 0 ? ShoppingCart : idx % 3 === 1 ? Gift : UsersRound;
                return (
                  <Link key={item.id} to={item.to} className="flex gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-500"><ActivityIcon className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.summary}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </Link>
                );
              }) : <p className="text-sm text-slate-500">No recent activity in this window.</p>}
              <Link to="/admin/activity-log" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600">View all activity <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Grid2X2 className="h-5 w-5 text-slate-500" />
              <h2 className="font-bold text-slate-950">Homepage Widgets</h2>
            </div>
            <div className="space-y-3 p-5">
              {OPTIONAL_WIDGET_IDS.slice(0, 4).map(id => {
                const widget = DASHBOARD_WIDGETS.find(w => w.id === id as WidgetId);
                if (!widget) return null;
                const enabled = activeWidgets.includes(id as WidgetId);
                return (
                  <button key={id} onClick={() => toggleWidget(id as WidgetId)} className="flex w-full items-center gap-3 rounded-lg text-left">
                    <span className={`flex h-5 w-5 items-center justify-center rounded ${enabled ? 'bg-orange-500 text-white' : 'border border-slate-200 text-transparent'}`}>{enabled && <Check className="h-3.5 w-3.5" />}</span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{widget.title}</span>
                    <GripVertical className="h-4 w-4 text-slate-300" />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-950">Performance Snapshot</h2>
          </div>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600">{rangeLabel}</button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Revenue', value: formatCurrency(stats?.revenue?.value || 0), change: stats?.revenue?.change || 0, icon: DollarSign, subtitle: comparisonLabel, bars: getMiniBars('revenue'), rangeAware: true },
            { label: 'Seats Sold', value: String(stats?.seatsSold?.value || 0), change: stats?.seatsSold?.change || 0, icon: Users, subtitle: comparisonLabel, bars: getMiniBars('seats'), rangeAware: true },
            { label: 'Repeat Rate', value: `${(stats?.repeatRate || 0).toFixed(0)}%`, change: 0, icon: RefreshCw, subtitle: rangeLabel, bars: getMiniBars('orders'), rangeAware: true },
            { label: 'Gift Card Liability', value: formatCurrency(stats?.giftCardLiability || 0), change: 0, icon: Gift, subtitle: 'Current outstanding', bars: [12, 12, 12, 12, 12, 12], rangeAware: false },
          ].map(tile => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="rounded-lg border border-slate-100 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{tile.label}</p>
                    <p className="mt-3 text-2xl font-bold text-slate-950">{tile.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{tile.subtitle}</p>
                  </div>
                  <Icon className="h-5 w-5 text-orange-500" />
                </div>
                <div className="mt-4 flex items-end gap-1 text-orange-500">
                  {tile.bars.map((h, i) => <span key={i} className={`w-1.5 rounded-full ${tile.rangeAware ? 'bg-orange-400' : 'bg-slate-300'}`} style={{ height: `${h}px` }} />)}
                  {tile.change !== 0 && <span className="ml-2 text-xs font-semibold text-emerald-600">↗ {Math.abs(tile.change).toFixed(0)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {activeOptionalWidgets.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Optional Widgets</h2>
            <button onClick={() => setShowConfig(true)} className="text-sm font-semibold text-orange-600">Edit widgets</button>
          </div>
          <div className="grid grid-cols-12 gap-5">
            {activeOptionalWidgets.map(widgetId => renderWidget(widgetId))}
          </div>
        </section>
      )}
    </div>
  );
}
