import { useState } from 'react';
import { useRevenueAnalytics, type RevenuePeriod } from '../../hooks/useRevenue';
import { formatCurrency } from '../../lib/utils';
import { DollarSign, TrendingUp, Users, ShoppingCart, Calendar, MapPin, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#eb6a3d', '#f08b67', '#fad3c3', '#9b3119', '#bd3c1b', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'];

export default function RevenuePage() {
  const [period, setPeriod] = useState<RevenuePeriod>('weekly');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: analytics, isLoading } = useRevenueAnalytics(period, {
    from: new Date(dateFrom).toISOString(),
    to: new Date(dateTo + 'T23:59:59').toISOString(),
  });

  if (isLoading) return <LoadingSpinner />;

  const statCards = [
    { title: 'Total Revenue', value: formatCurrency(analytics?.totalRevenue || 0), icon: DollarSign, color: 'text-green-600' },
    { title: 'Total Orders', value: analytics?.totalOrders || 0, icon: ShoppingCart, color: 'text-blue-600' },
    { title: 'Seats Sold', value: analytics?.totalSeats || 0, icon: Users, color: 'text-purple-600' },
    { title: 'Avg Order Value', value: formatCurrency(analytics?.avgOrderValue || 0), icon: TrendingUp, color: 'text-primary-600' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Revenue Analytics</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track revenue, orders, and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
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
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>to</span>
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
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
            {(['daily', 'weekly', 'monthly'] as RevenuePeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-sm rounded-md transition-colors"
                style={{
                  backgroundColor: period === p ? 'var(--bg-primary)' : 'transparent',
                  color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: period === p ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map(stat => (
          <Card key={stat.title}>
            <CardContent className="flex items-center p-6">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <stat.icon className="h-6 w-6" style={{ color: stat.color.includes('green') ? '#22c55e' : stat.color.includes('blue') ? '#3b82f6' : stat.color.includes('purple') ? '#a855f7' : '#eb6a3d' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{stat.title}</p>
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 min-h-px min-w-px">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 320 }}>
                <BarChart data={analytics?.timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} angle={-30} textAnchor="end" height={60} />
                  <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
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
              <MapPin className="h-5 w-5" />
              Revenue by Venue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(analytics?.byVenue && analytics.byVenue.length > 0) ? (
              <div className="h-80 min-h-px min-w-px">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 320 }}>
                  <PieChart>
                    <Pie
                      data={analytics.byVenue}
                      dataKey="revenue"
                      nameKey="venueName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {analytics.byVenue.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                No venue data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Revenue by Event
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(analytics?.byEvent && analytics.byEvent.length > 0) ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Event</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 text-sm">Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 text-sm">Orders</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 text-sm">Seats</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 text-sm">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byEvent
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((evt) => (
                      <tr key={evt.eventType} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900 text-sm">{evt.eventType}</td>
                        <td className="py-3 px-4 text-right text-sm text-gray-900">{formatCurrency(evt.revenue)}</td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">{evt.orders}</td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">{evt.seats}</td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {analytics.totalRevenue > 0 ? ((evt.revenue / analytics.totalRevenue) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No event revenue data available for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
