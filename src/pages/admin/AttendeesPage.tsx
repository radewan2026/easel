import { useState, useMemo, useRef, useEffect } from 'react';
import { useOrders } from '../../hooks/useEvents';
import { formatDateTime } from '../../lib/utils';
import { exportData, type ExportFormat } from '../../lib/export';
import { Users, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, Download, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import type { Attendee, Order } from '../../types/database';

type SortField = 'name' | 'email' | 'event' | 'orderDate' | 'status';
type SortDirection = 'asc' | 'desc';

type AttendeeWithOrder = Attendee & {
  order: Order;
};

type SortValue = string | number;

function getSortValue(attendee: AttendeeWithOrder, field: SortField): SortValue {
  switch (field) {
    case 'name':
      return attendee.full_name || '';
    case 'email':
      return attendee.email || '';
    case 'event':
      return attendee.order.event?.title || '';
    case 'orderDate':
      return new Date(attendee.order.created_at).getTime();
    case 'status':
      return attendee.order.status;
  }
}

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1 inline" /> : <ArrowDown className="h-4 w-4 ml-1 inline" />;
}

export default function AdminAttendeesPage() {
  const { data: orders, isLoading } = useOrders();
  const [sortField, setSortField] = useState<SortField>('orderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  const allAttendees: AttendeeWithOrder[] = useMemo(() => {
    if (!orders) return [];
    const attendees: AttendeeWithOrder[] = [];
    orders.forEach(order => {
      if (order.attendees && order.attendees.length > 0) {
        order.attendees.forEach(attendee => {
          attendees.push({ ...attendee, order });
        });
      }
    });
    return attendees;
  }, [orders]);

  const filteredAttendees = useMemo(() => {
    const filtered = allAttendees.filter(a => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = a.full_name?.toLowerCase().includes(q);
        const emailMatch = a.email?.toLowerCase().includes(q);
        const eventMatch = a.order.event?.title?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !eventMatch) return false;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const orderDate = new Date(a.order.created_at);
        if (dateFrom && orderDate < new Date(dateFrom)) return false;
        if (dateTo && orderDate > new Date(dateTo + 'T23:59:59')) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);

      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allAttendees, searchQuery, dateFrom, dateTo, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAttendees.length / pageSize);
  const paginatedAttendees = filteredAttendees.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
    pending: 'warning',
    paid: 'success',
    cancelled: 'danger',
    refunded: 'danger',
  };

  const handleExport = async (format: ExportFormat) => {
    const data = filteredAttendees.map(a => ({
      Name: a.full_name || '',
      Email: a.email || '',
      Event: a.order.event?.title || '',
      'Order Date': formatDateTime(a.order.created_at),
      Status: a.order.status,
      'Seats': a.order.total_seats,
      'Total': a.order.total_amount,
    }));
    await exportData(data, 'attendees', format, 'Attendees Report');
    setExportOpen(false);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Attendees</h1>
          <p style={{ color: 'var(--text-muted)' }}>View all event attendees ({allAttendees.length} total)</p>
        </div>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-lg shadow-lg border py-1 z-50" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                <FileText className="h-4 w-4 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">CSV</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Comma-separated values</p>
                </div>
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <div className="text-left">
                  <p className="font-medium">Excel</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>.xlsx spreadsheet</p>
                </div>
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                <FileDown className="h-4 w-4 text-red-500" />
                <div className="text-left">
                  <p className="font-medium">PDF</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Printable document</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search by name, email, or event..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ 
              backgroundColor: 'var(--admin-input-bg)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>All Attendees</CardTitle>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredAttendees.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('name')}>
                    Name <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('email')}>
                    Email <SortIcon field="email" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('event')}>
                    Event <SortIcon field="event" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('orderDate')}>
                    Order Date <SortIcon field="orderDate" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('status')}>
                    Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAttendees.map((attendee, idx) => (
                  <tr key={`${attendee.id}-${idx}`} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {attendee.full_name || '-'}
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                      {attendee.email || '-'}
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                      {attendee.order.event?.title || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {formatDateTime(attendee.order.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={statusColors[attendee.order.status]}>
                        {attendee.order.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAttendees.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <Users className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              No attendees found
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredAttendees.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
        </CardContent>
      </Card>
    </div>
  );
}
