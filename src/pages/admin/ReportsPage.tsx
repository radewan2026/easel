import { useMemo, useState } from 'react';
import { useSalesReport, useCustomerAnalytics, useProductPerformance, useRevenueReport } from '../../hooks/useReports';
import { useEmployees } from '../../hooks/useEmployees';
import { useEventAssignments } from '../../hooks/useEventAssignments';
import { usePayRecords } from '../../hooks/usePayRecords';
import { useEvents, useOrders } from '../../hooks/useEvents';
import { usePrivateEventRequests } from '../../hooks/usePrivateEventRequests';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Calendar, Download, DollarSign, ShoppingCart, Users, Package, TrendingUp, AlertTriangle, Clock, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';

const COLORS = ['#eb6a3d', '#f08b67', '#fad3c3', '#9b3119', '#bd3c1b', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'];

type ReportTab = 'overview' | 'sales' | 'customers' | 'products' | 'revenue' | 'advanced' | 'staff';

type PeriodMode = 'weekly' | 'monthly' | 'quarterly';

function getPeriodKey(value: string, mode: PeriodMode) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  if (mode === 'weekly') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (mode === 'quarterly') {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getDaypart(value: string) {
  const hour = new Date(value).getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [reportNow] = useState(() => Date.now());
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const dateRange = {
    from: new Date(dateFrom).toISOString(),
    to: new Date(dateTo + 'T23:59:59').toISOString(),
  };

  const { data: salesReport, isLoading: salesLoading } = useSalesReport(dateRange);
  const { data: customerAnalytics, isLoading: customerLoading } = useCustomerAnalytics(dateRange);
  const { data: productPerformance, isLoading: productLoading } = useProductPerformance(dateRange);
  const { data: revenueReport, isLoading: revenueLoading } = useRevenueReport(dateRange);
  const { data: events = [] } = useEvents();
  const { data: orders = [] } = useOrders();
  const { data: privateRequests = [] } = usePrivateEventRequests();

  const { data: staffEmployees } = useEmployees({ status: 'active' });
  const { data: staffAssignments } = useEventAssignments({});
  const { data: staffPaidRecords } = usePayRecords({ status: 'paid' });
  const { data: staffApprovedRecords } = usePayRecords({ status: 'approved' });

  const staffCompletedAssignments = (staffAssignments || []).filter(a => a.status === 'completed');
  const staffTotalHours = staffCompletedAssignments.reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);
  const staffTotalPayDisbursed = (staffPaidRecords || []).reduce((sum, p) => sum + Number(p.pay_amount), 0);
  const staffOutstandingPay = (staffApprovedRecords || []).reduce((sum, p) => sum + Number(p.pay_amount), 0);

  const advancedReports = useMemo(() => {
    const fromTime = new Date(dateRange.from).getTime();
    const toTime = new Date(dateRange.to).getTime();
    const eventOrders = orders.filter((order) => {
      const created = new Date(order.created_at).getTime();
      return created >= fromTime && created <= toTime && ['paid', 'pending'].includes(order.status);
    });
    const eventsInRange = events.filter((event) => {
      const start = new Date(event.start_datetime).getTime();
      return start >= fromTime && start <= toTime;
    });
    const requestsInRange = privateRequests.filter((request) => {
      const created = new Date(request.created_at).getTime();
      return created >= fromTime && created <= toTime;
    });

    const ordersByEvent = new Map<string, typeof eventOrders>();
    eventOrders.forEach((order) => {
      const list = ordersByEvent.get(order.event_id) || [];
      list.push(order);
      ordersByEvent.set(order.event_id, list);
    });

    const payrollByEvent = new Map<string, number>();
    [...(staffPaidRecords || []), ...(staffApprovedRecords || [])].forEach((payRecord) => {
      payrollByEvent.set(payRecord.event_id, (payrollByEvent.get(payRecord.event_id) || 0) + Number(payRecord.pay_amount || 0));
    });

    const assignmentsByEvent = new Map<string, string[]>();
    (staffAssignments || []).forEach((assignment) => {
      const label = assignment.employee?.name || staffEmployees?.find((employee) => employee.id === assignment.employee_id)?.name || 'Unassigned';
      const list = assignmentsByEvent.get(assignment.event_id) || [];
      if (!list.includes(label)) list.push(label);
      assignmentsByEvent.set(assignment.event_id, list);
    });

    const eventProfitability = eventsInRange.map((event) => {
      const relatedOrders = ordersByEvent.get(event.id) || [];
      const seatsSold = relatedOrders.reduce((sum, order) => sum + Number(order.total_seats || 0), 0) || Math.max(0, Number(event.max_seats || 0) - Number(event.seats_available || 0));
      const revenue = relatedOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
      const payroll = payrollByEvent.get(event.id) || 0;
      const capacity = Number(event.max_seats || 0);
      return {
        eventId: event.id,
        title: event.title,
        date: event.start_datetime,
        day: new Date(event.start_datetime).toLocaleDateString('en-US', { weekday: 'short' }),
        daypart: getDaypart(event.start_datetime),
        venue: event.venue?.name || event.venue_id || 'No venue',
        painting: event.title,
        instructor: (assignmentsByEvent.get(event.id) || ['Unassigned']).join(', '),
        seatsSold,
        capacity,
        fillRate: capacity > 0 ? (seatsSold / capacity) * 100 : 0,
        revenue,
        payroll,
        profit: revenue - payroll,
        profitPerSeat: seatsSold > 0 ? (revenue - payroll) / seatsSold : 0,
      };
    }).sort((a, b) => b.profit - a.profit);

    const groupRows = (key: 'venue' | 'day' | 'daypart' | 'instructor' | 'painting') => {
      const grouped = new Map<string, { label: string; events: number; revenue: number; profit: number; seats: number; capacity: number }>();
      eventProfitability.forEach((event) => {
        const labels = key === 'instructor' ? event.instructor.split(', ') : [event[key]];
        labels.forEach((label) => {
          const current = grouped.get(label) || { label, events: 0, revenue: 0, profit: 0, seats: 0, capacity: 0 };
          current.events += 1;
          current.revenue += event.revenue;
          current.profit += event.profit;
          current.seats += event.seatsSold;
          current.capacity += event.capacity;
          grouped.set(label, current);
        });
      });
      return Array.from(grouped.values())
        .map((row) => ({ ...row, fillRate: row.capacity > 0 ? (row.seats / row.capacity) * 100 : 0 }))
        .sort((a, b) => b.profit - a.profit);
    };

    const trendMap = new Map<string, { label: string; revenue: number; profit: number; seats: number; events: number }>();
    eventProfitability.forEach((event) => {
      const label = getPeriodKey(event.date, periodMode);
      const current = trendMap.get(label) || { label, revenue: 0, profit: 0, seats: 0, events: 0 };
      current.revenue += event.revenue;
      current.profit += event.profit;
      current.seats += event.seatsSold;
      current.events += 1;
      trendMap.set(label, current);
    });

    const privateConverted = requestsInRange.filter((request) => ['confirmed', 'converted_to_event'].includes(request.status)).length;
    const privateLost = requestsInRange.filter((request) => request.status === 'declined').length;
    const pipelineValue = requestsInRange.reduce((sum, request) => sum + Number(request.deposit_amount || request.guest_count * 49), 0);
    const openPipelineValue = requestsInRange
      .filter((request) => !['declined', 'converted_to_event'].includes(request.status))
      .reduce((sum, request) => sum + Number(request.deposit_amount || request.guest_count * 49), 0);
    const privateStatusRows = Object.entries(requestsInRange.reduce<Record<string, number>>((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {})).map(([status, count]) => ({ status: status.replace(/_/g, ' '), count }));

    const lowFillEvents = eventProfitability
      .filter((event) => event.capacity > 0 && event.fillRate < 40 && new Date(event.date).getTime() >= reportNow)
      .sort((a, b) => a.fillRate - b.fillRate)
      .slice(0, 5);

    const recommendedActions = [
      lowFillEvents[0] ? `Promote ${lowFillEvents[0].title}: it is only ${lowFillEvents[0].fillRate.toFixed(0)}% full.` : null,
      privateConverted / Math.max(requestsInRange.length, 1) < 0.35 && requestsInRange.length > 0 ? 'Review the private event follow-up process; conversion is below 35% for this range.' : null,
      groupRows('daypart').at(-1) ? `Audit ${groupRows('daypart').at(-1)?.label.toLowerCase()} classes; they are the weakest daypart by profit.` : null,
      eventProfitability[0] ? `Repeat the format of ${eventProfitability[0].title}; it is the strongest event by estimated profit.` : null,
    ].filter(Boolean) as string[];

    return {
      eventProfitability,
      byVenue: groupRows('venue'),
      byDay: groupRows('day'),
      byDaypart: groupRows('daypart'),
      byInstructor: groupRows('instructor'),
      byPainting: groupRows('painting'),
      trend: Array.from(trendMap.values()),
      privateRequests: requestsInRange,
      privateStatusRows,
      privateConverted,
      privateLost,
      privateConversionRate: requestsInRange.length > 0 ? (privateConverted / requestsInRange.length) * 100 : 0,
      pipelineValue,
      openPipelineValue,
      lowFillEvents,
      recommendedActions,
    };
  }, [dateRange.from, dateRange.to, events, orders, periodMode, privateRequests, reportNow, staffApprovedRecords, staffAssignments, staffEmployees, staffPaidRecords]);

  const insightCards = [
    {
      title: 'Revenue Mix',
      value: revenueReport?.combinedRevenue ? `${Math.round(((revenueReport.totalEventRevenue || 0) / revenueReport.combinedRevenue) * 100)}%` : '0%',
      detail: 'of revenue from events',
      tone: 'primary',
    },
    {
      title: 'Customer Retention',
      value: `${(customerAnalytics?.customerRetention || 0).toFixed(0)}%`,
      detail: customerAnalytics?.returningCustomers ? `${customerAnalytics.returningCustomers} returning customers` : 'No returning customer signal yet',
      tone: (customerAnalytics?.customerRetention || 0) >= 25 ? 'success' : 'warning',
    },
    {
      title: 'Inventory Risk',
      value: `${(productPerformance?.lowStockProducts.length || 0) + (productPerformance?.outOfStockProducts.length || 0)}`,
      detail: 'products low or out of stock',
      tone: ((productPerformance?.lowStockProducts.length || 0) + (productPerformance?.outOfStockProducts.length || 0)) > 0 ? 'warning' : 'success',
    },
    {
      title: 'Payroll Ready',
      value: formatCurrency(staffOutstandingPay),
      detail: 'approved and awaiting payment',
      tone: staffOutstandingPay > 0 ? 'warning' : 'success',
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'sales', label: 'Sales & Orders' },
    { id: 'customers', label: 'Customers' },
    { id: 'products', label: 'Products' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'staff', label: 'Staff' },
  ];

  const exportToCSV = (data: Array<Array<string | number>>, filename: string, headers: string[]) => {
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const isLoading = salesLoading || customerLoading || productLoading || revenueLoading;

  if (isLoading) return <LoadingSpinner />;

  const revenueBreakdown = revenueReport ? [
    { name: 'Event Revenue', value: revenueReport.totalEventRevenue },
    { name: 'Product Revenue', value: revenueReport.totalProductRevenue },
    { name: 'Gift Card Revenue', value: revenueReport.totalGiftCardRevenue },
  ].filter(item => item.value > 0) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>
          <p style={{ color: 'var(--text-muted)' }}>Analytics and insights across your business</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <label htmlFor="reports-from" className="sr-only">From</label>
            <input
              id="reports-from"
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
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>to</span>
            <label htmlFor="reports-to" className="sr-only">To</label>
            <input
              id="reports-to"
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
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: activeTab === tab.id ? 'white' : 'var(--text-primary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {insightCards.map((insight) => (
          <Card key={insight.title}>
            <CardContent className="pt-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{insight.title}</p>
              <p className="text-2xl font-bold" style={{
                color: insight.tone === 'success' ? '#16a34a' : insight.tone === 'warning' ? '#d97706' : 'var(--primary-color)'
              }}>{insight.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{insight.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Revenue</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(revenueReport?.combinedRevenue || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Orders</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {salesReport?.totalOrders || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Customers</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {customerAnalytics?.totalCustomers || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Products Sold</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {productPerformance?.topProducts.reduce((acc, p) => acc + p.unitsSold, 0) || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 min-h-px min-w-px">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 288 }}>
                    <BarChart data={salesReport?.timeline || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="label" fontSize={11} angle={-30} textAnchor="end" height={60} tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} tick={{ fill: 'var(--text-muted)' }} />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'revenue') return formatCurrency(Number(value));
                          return value;
                        }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="revenue" fill="#eb6a3d" radius={[4, 4, 0, 0]} name="revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Revenue by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueBreakdown.length > 0 ? (
                  <div className="h-72 min-h-px min-w-px">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 288 }}>
                      <PieChart>
                        <Pie
                          data={revenueBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        >
                          {revenueBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Orders</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{salesReport?.totalOrders || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Revenue</p>
                <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{formatCurrency(salesReport?.totalRevenue || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Seats Sold</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{salesReport?.totalSeats || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Avg Order Value</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(salesReport?.avgOrderValue || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Orders by Event</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const data = (salesReport?.ordersByEvent || []).map(e => [
                    e.eventTitle,
                    e.count,
                    formatCurrency(e.revenue)
                  ]);
                  exportToCSV(data, 'sales-by-event', ['Event', 'Orders', 'Revenue']);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Event</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Orders</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesReport?.ordersByEvent || [])
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((evt) => (
                        <tr key={evt.eventId} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{evt.eventTitle}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{evt.count}</td>
                          <td className="py-3 px-4 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(evt.revenue)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 min-h-px min-w-px">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 288 }}>
                  <LineChart data={salesReport?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="label" fontSize={11} angle={-30} textAnchor="end" height={60} tick={{ fill: 'var(--text-muted)' }} />
                    <YAxis fontSize={12} tick={{ fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="orders" stroke="#eb6a3d" strokeWidth={2} dot={false} name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Customers</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{customerAnalytics?.totalCustomers || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>New Customers</p>
                <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{customerAnalytics?.newCustomers || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Returning</p>
                <p className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{customerAnalytics?.returningCustomers || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Retention Rate</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{(customerAnalytics?.customerRetention || 0).toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Avg Orders per Customer</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{(customerAnalytics?.averageOrdersPerCustomer || 0).toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Avg Lifetime Value</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(customerAnalytics?.averageLifetimeValue || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top Customers</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const data = (customerAnalytics?.topCustomers || []).map(c => [
                    c.name,
                    c.email,
                    c.totalOrders,
                    formatCurrency(c.totalSpent),
                    c.lastOrderDate ? formatDateTime(c.lastOrderDate) : '-'
                  ]);
                  exportToCSV(data, 'top-customers', ['Name', 'Email', 'Orders', 'Total Spent', 'Last Order']);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Customer</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Orders</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Total Spent</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Last Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(customerAnalytics?.topCustomers || []).map((customer, idx) => (
                      <tr key={idx} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{customer.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{customer.email}</div>
                        </td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{customer.totalOrders}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(customer.totalSpent)}</td>
                        <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                          {customer.lastOrderDate ? formatDateTime(customer.lastOrderDate) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Sold</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {productPerformance?.topProducts.reduce((acc, p) => acc + p.unitsSold, 0) || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Product Revenue</p>
                <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>
                  {formatCurrency(productPerformance?.topProducts.reduce((acc, p) => acc + p.revenue, 0) || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Low Stock</p>
                <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>
                  {productPerformance?.lowStockProducts.length || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Out of Stock</p>
                <p className="text-3xl font-bold" style={{ color: '#ef4444' }}>
                  {productPerformance?.outOfStockProducts.length || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {productPerformance?.outOfStockProducts && productPerformance.outOfStockProducts.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Out of Stock Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {productPerformance.outOfStockProducts.map((p) => (
                    <div key={p.productId} className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{p.productName}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.categoryName}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {productPerformance?.lowStockProducts && productPerformance.lowStockProducts.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Product</th>
                        <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Stock</th>
                        <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPerformance.lowStockProducts.map((p) => (
                        <tr key={p.productId} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.productName}</td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-yellow-600">{p.stock}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-muted)' }}>{p.categoryName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top Selling Products</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const data = (productPerformance?.topProducts || []).map(p => [
                    p.productName,
                    p.categoryName,
                    p.unitsSold,
                    formatCurrency(p.revenue),
                    formatCurrency(p.avgPrice)
                  ]);
                  exportToCSV(data, 'top-products', ['Product', 'Category', 'Units Sold', 'Revenue', 'Avg Price']);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Product</th>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Category</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Units Sold</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(productPerformance?.topProducts || []).map((product) => (
                      <tr key={product.productId} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{product.productName}</td>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{product.categoryName}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{product.unitsSold}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(product.revenue)}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-muted)' }}>{formatCurrency(product.avgPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {productPerformance?.categoryBreakdown && productPerformance.categoryBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 min-h-px min-w-px">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 288 }}>
                    <BarChart data={productPerformance.categoryBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis type="category" dataKey="categoryName" width={120} tick={{ fill: 'var(--text-muted)' }} />
                      <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="revenue" fill="#eb6a3d" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Combined Revenue</p>
                <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{formatCurrency(revenueReport?.combinedRevenue || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Event Revenue</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(revenueReport?.totalEventRevenue || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Product Revenue</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(revenueReport?.totalProductRevenue || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Gift Card Revenue</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(revenueReport?.totalGiftCardRevenue || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueBreakdown.length > 0 ? (
                  <div className="h-72 min-h-px min-w-px">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 288 }}>
                      <PieChart>
                        <Pie
                          data={revenueBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        >
                          {revenueBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Venue</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueReport?.revenueByVenue && revenueReport.revenueByVenue.length > 0 ? (
                  <div className="h-72 min-h-px min-w-px">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 288 }}>
                      <BarChart data={revenueReport.revenueByVenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="venueName" fontSize={11} angle={-30} textAnchor="end" height={60} tick={{ fill: 'var(--text-muted)' }} />
                        <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: 'var(--text-muted)' }} />
                        <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="revenue" fill="#eb6a3d" name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    No venue data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Monthly Revenue Breakdown</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const data = (revenueReport?.revenueByMonth || []).map(m => [
                    m.label,
                    formatCurrency(m.eventRevenue),
                    formatCurrency(m.productRevenue),
                    formatCurrency(m.giftCardRevenue)
                  ]);
                  exportToCSV(data, 'monthly-revenue', ['Month', 'Event Revenue', 'Product Revenue', 'Gift Card Revenue']);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Month</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Event Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Product Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Gift Card Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(revenueReport?.revenueByMonth || []).map((month) => (
                      <tr key={month.month} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{month.label}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(month.eventRevenue)}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(month.productRevenue)}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(month.giftCardRevenue)}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(month.eventRevenue + month.productRevenue + month.giftCardRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
</div>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Estimated Event Profit</p>
                <p className="text-3xl font-bold" style={{ color: '#16a34a' }}>
                  {formatCurrency(advancedReports.eventProfitability.reduce((sum, event) => sum + event.profit, 0))}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Revenue minus approved/paid payroll</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Private Conversion</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--primary-color)' }}>
                  {advancedReports.privateConversionRate.toFixed(0)}%
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {advancedReports.privateConverted} converted of {advancedReports.privateRequests.length} requests
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Open Pipeline Value</p>
                <p className="text-3xl font-bold" style={{ color: '#d97706' }}>{formatCurrency(advancedReports.openPipelineValue)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Estimated from deposits or guest count</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Low-Fill Events</p>
                <p className="text-3xl font-bold" style={{ color: advancedReports.lowFillEvents.length > 0 ? '#d97706' : '#16a34a' }}>
                  {advancedReports.lowFillEvents.length}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Upcoming events under 40% full</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recommended Actions</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const data = advancedReports.eventProfitability.map((event) => [
                    event.title,
                    formatDateTime(event.date),
                    event.venue,
                    event.instructor,
                    event.seatsSold,
                    `${event.fillRate.toFixed(0)}%`,
                    event.revenue.toFixed(2),
                    event.payroll.toFixed(2),
                    event.profit.toFixed(2),
                  ]);
                  exportToCSV(data, 'advanced-event-profitability', ['Event', 'Date', 'Venue', 'Instructor', 'Seats Sold', 'Fill Rate', 'Revenue', 'Payroll', 'Estimated Profit']);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Event Profitability
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {(advancedReports.recommendedActions.length > 0 ? advancedReports.recommendedActions : ['No urgent reporting actions for this range.']).map((action) => (
                  <div key={action} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Visual Trend Comparison</CardTitle>
                <div className="flex rounded-lg border p-1" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  {(['weekly', 'monthly', 'quarterly'] as PeriodMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPeriodMode(mode)}
                      className="rounded-md px-3 py-1 text-sm font-medium capitalize"
                      style={{
                        backgroundColor: periodMode === mode ? 'var(--primary-color)' : 'transparent',
                        color: periodMode === mode ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80 min-h-px min-w-px">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 760, height: 320 }}>
                    <ComposedChart data={advancedReports.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis yAxisId="money" tickFormatter={(value) => `$${value}`} tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis yAxisId="seats" orientation="right" tick={{ fill: 'var(--text-muted)' }} />
                      <Tooltip formatter={(value: unknown, name: unknown) => name === 'Seats' ? Number(value) : formatCurrency(Number(value))} />
                      <Bar yAxisId="money" dataKey="revenue" fill="#eb6a3d" name="Revenue" />
                      <Line yAxisId="money" type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={3} name="Profit" />
                      <Line yAxisId="seats" type="monotone" dataKey="seats" stroke="#2563eb" strokeWidth={2} name="Seats" />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Private Event Conversion</CardTitle>
              </CardHeader>
              <CardContent>
                {advancedReports.privateStatusRows.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-56 min-h-px min-w-px">
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 420, height: 224 }}>
                        <PieChart>
                          <Pie data={advancedReports.privateStatusRows} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={78} label>
                            {advancedReports.privateStatusRows.map((_, index) => (
                              <Cell key={`private-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total pipeline</p>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(advancedReports.pipelineValue)}</p>
                      </div>
                      <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lost requests</p>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{advancedReports.privateLost}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No private requests in this date range.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Instructor / Venue / Daypart Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { title: 'Top Instructors', rows: advancedReports.byInstructor.slice(0, 4) },
                    { title: 'Top Venues', rows: advancedReports.byVenue.slice(0, 4) },
                    { title: 'Top Dayparts', rows: advancedReports.byDaypart.slice(0, 4) },
                  ].map((section) => (
                    <div key={section.title} className="space-y-3">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{section.title}</p>
                      {section.rows.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet</p>
                      ) : section.rows.map((row) => (
                        <div key={row.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(row.profit)} profit · {row.fillRate.toFixed(0)}% fill</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Painting Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {advancedReports.byPainting.slice(0, 5).map((painting) => (
                    <div key={painting.label} className="flex items-center justify-between gap-4 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{painting.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{painting.events} event{painting.events === 1 ? '' : 's'} · {painting.seats} seats sold</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(painting.profit)}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{painting.fillRate.toFixed(0)}% fill</p>
                      </div>
                    </div>
                  ))}
                  {advancedReports.byPainting.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No painting performance data in this range.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Event Profitability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Event</th>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Date</th>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Instructor</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Fill</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Payroll</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedReports.eventProfitability.slice(0, 12).map((event) => (
                      <tr key={event.eventId} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{event.title}</td>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(event.date)}</td>
                        <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{event.instructor}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{event.fillRate.toFixed(0)}%</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(event.revenue)}</td>
                        <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(event.payroll)}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium" style={{ color: event.profit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(event.profit)}</td>
                      </tr>
                    ))}
                    {advancedReports.eventProfitability.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No event profitability data in this date range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Hours</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{staffTotalHours.toFixed(1)}</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><Clock className="h-5 w-5 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Pay Disbursed</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: '#22c55e' }}>{formatCurrency(staffTotalPayDisbursed)}</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><DollarSign className="h-5 w-5 text-green-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Outstanding Pay</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: '#f59e0b' }}>{formatCurrency(staffOutstandingPay)}</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Active Employees</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{staffEmployees?.length || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}><UserCheck className="h-5 w-5 text-purple-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Hours by Employee</CardTitle>
              <Button variant="ghost" onClick={() => {
                const headers = ['Employee', 'Role', 'Events Worked', 'Total Hours', 'Avg Hours/Event', 'Total Pay Earned', 'Total Paid', 'Outstanding'];
                const data = (staffEmployees || []).map(emp => {
                  const empAssignments = staffCompletedAssignments.filter(a => a.employee_id === emp.id);
                  const empPaid = (staffPaidRecords || []).filter(p => p.employee_id === emp.id);
                  const empApproved = (staffApprovedRecords || []).filter(p => p.employee_id === emp.id);
                  const hours = empAssignments.reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);
                  return [emp.name, emp.role, empAssignments.length, hours.toFixed(1), empAssignments.length > 0 ? (hours / empAssignments.length).toFixed(1) : '0', empPaid.reduce((s, p) => s + Number(p.pay_amount), 0).toFixed(2), empPaid.reduce((s, p) => s + Number(p.pay_amount), 0).toFixed(2), empApproved.reduce((s, p) => s + Number(p.pay_amount), 0).toFixed(2)];
                });
                exportToCSV(data, 'staff-report', headers);
              }}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Role</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Events Worked</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Total Hours</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Avg Hours/Event</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Total Pay Earned</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Total Paid</th>
                      <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(staffEmployees || []).map(emp => {
                      const empAssignments = staffCompletedAssignments.filter(a => a.employee_id === emp.id);
                      const empPaid = (staffPaidRecords || []).filter(p => p.employee_id === emp.id);
                      const empApproved = (staffApprovedRecords || []).filter(p => p.employee_id === emp.id);
                      const hours = empAssignments.reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);
                      const totalEarned = empPaid.reduce((s, p) => s + Number(p.pay_amount), 0) + empApproved.reduce((s, p) => s + Number(p.pay_amount), 0);
                      const totalPaid = empPaid.reduce((s, p) => s + Number(p.pay_amount), 0);
                      const outstanding = empApproved.reduce((s, p) => s + Number(p.pay_amount), 0);
                      return (
                        <tr key={emp.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{emp.name}</td>
                          <td className="py-3 px-4 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{emp.role}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{empAssignments.length}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{hours.toFixed(1)}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{empAssignments.length > 0 ? (hours / empAssignments.length).toFixed(1) : '—'}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalEarned)}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: '#22c55e' }}>{formatCurrency(totalPaid)}</td>
                          <td className="py-3 px-4 text-right text-sm" style={{ color: outstanding > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>{formatCurrency(outstanding)}</td>
                        </tr>
                      );
                    })}
                    {(staffEmployees || []).length === 0 && (
                      <tr><td colSpan={8} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No employees found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
