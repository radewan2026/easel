import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReasonConfirmDialog } from '../../components/ui/ReasonConfirmDialog';
import { useEvents, useCreateEvent, useTrashEvent } from '../../hooks/useEvents';
import { useEventAssignments } from '../../hooks/useEventAssignments';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { Plus, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Copy, Calendar, Filter, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { Pagination } from '../../components/ui/Pagination';
import type { Event } from '../../types/database';
import { getEventHealth } from '../../lib/adminInsights';
import { logActivity } from '../../lib/activityLog';

type SortField = 'title' | 'start_datetime' | 'venue' | 'base_price_per_seat' | 'is_published';
type SortDirection = 'asc' | 'desc';
type EventTab = 'current' | 'past' | 'recurring';
type EventSavedView = 'all' | 'needs_promotion' | 'needs_staff' | 'at_risk' | 'this_week';
type SortValue = string | number | boolean | null;
type RecurrenceSummary = { type?: string };

function getRecurrenceSummary(event: Event): RecurrenceSummary | null {
  const recurrence = event.recurrence as RecurrenceSummary | null;
  return recurrence?.type ? recurrence : null;
}

function getEventSortValue(event: Event, field: SortField): SortValue {
  if (field === 'venue') return event.venue?.name || '';
  if (field === 'start_datetime') return new Date(event.start_datetime).getTime();
  return event[field];
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1 inline" /> : <ArrowDown className="h-4 w-4 ml-1 inline" />;
}

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const { data: events, isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const trashEvent = useTrashEvent();
  const { data: allAssignments } = useEventAssignments();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<EventTab>('current');
  const [sortField, setSortField] = useState<SortField>('start_datetime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [savedView, setSavedView] = useState<EventSavedView>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [activeTab, dateFrom, dateTo, savedView]);

  const handleDuplicate = async (event: Event) => {
    try {
      const newEvent = {
        title: `${event.title} (Copy)`,
        slug: `${event.slug}-copy-${event.id.slice(0, 4)}`,
        description: event.description || null,
        start_datetime: event.start_datetime,
        end_datetime: event.end_datetime,
        venue_id: event.venue_id,
        base_price_per_seat: event.base_price_per_seat,
        max_seats: event.max_seats,
        seats_available: event.max_seats,
        main_image_url: event.main_image_url,
        is_published: false,
      };
      await createEvent.mutateAsync(newEvent);
      showToast('Event duplicated!');
    } catch (err: unknown) {
      console.debug('Failed to duplicate event', err);
      showToast('Failed to duplicate event', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (reason: string) => {
    if (deleteTarget) {
      try {
        await trashEvent.mutateAsync(deleteTarget);
        const event = events?.find((e) => e.id === deleteTarget);
        await logActivity({
          action: 'event.deleted',
          entityType: 'event',
          entityId: deleteTarget,
          entityName: event?.title,
          details: { reason: reason || 'No reason provided', guardrail: true },
        });
        showToast('Event moved to trash!');
      } catch (err: unknown) {
        console.debug('Failed to delete event', err);
        showToast('Failed to delete event', 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const staffingLookup = useMemo(() => {
    const map = new Map<string, { assigned: number; confirmed: number; total: number }>();
    if (!allAssignments) return map;
    for (const a of allAssignments) {
      const entry = map.get(a.event_id) || { assigned: 0, confirmed: 0, total: 0 };
      entry.total++;
      if (a.status === 'assigned') entry.assigned++;
      if (a.status === 'confirmed') entry.confirmed++;
      map.set(a.event_id, entry);
    }
    return map;
  }, [allAssignments]);

  const eventHealth = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEventHealth>>();
    events?.forEach((event) => {
      map.set(event.id, getEventHealth(event, staffingLookup.get(event.id)));
    });
    return map;
  }, [events, staffingLookup]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const filtered = events.filter(e => {
      const eventDate = new Date(e.start_datetime);
      const health = eventHealth.get(e.id);
      
      // Tab filter
      if (activeTab === 'current') {
        if (eventDate < now) return false;
      } else if (activeTab === 'past') {
        if (eventDate >= now) return false;
      } else if (activeTab === 'recurring') {
        if (!getRecurrenceSummary(e)) return false;
      }

      // Date range filter
      if (dateFrom && eventDate < new Date(dateFrom)) return false;
      if (dateTo && eventDate > new Date(dateTo + 'T23:59:59')) return false;

      if (savedView !== 'all') {
        if (savedView === 'this_week') {
          if (eventDate < now || eventDate > weekFromNow) return false;
        } else if (health?.status !== savedView) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = getEventSortValue(a, sortField);
      const bVal = getEventSortValue(b, sortField);
      
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [events, activeTab, dateFrom, dateTo, savedView, eventHealth, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const tabs: { id: EventTab; label: string; count: number }[] = [
    { id: 'current', label: 'Current', count: events?.filter(e => new Date(e.start_datetime) >= new Date()).length || 0 },
    { id: 'past', label: 'Past', count: events?.filter(e => new Date(e.start_datetime) < new Date()).length || 0 },
    { id: 'recurring', label: 'Recurring', count: events?.filter(e => getRecurrenceSummary(e)).length || 0 },
  ];

  const getStaffingIcon = (eventId: string) => {
    const s = staffingLookup.get(eventId);
    if (!s || s.total === 0) return { color: 'var(--text-muted)', title: 'No staff assigned' };
    if (s.confirmed > 0) return { color: '#22c55e', title: `${s.confirmed} confirmed, ${s.assigned} pending` };
    return { color: '#f59e0b', title: `${s.assigned} assigned, none confirmed` };
  };

  const savedViews: { id: EventSavedView; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: events?.length || 0 },
    { id: 'needs_promotion', label: 'Needs Promotion', count: Array.from(eventHealth.values()).filter(h => h.status === 'needs_promotion').length },
    { id: 'needs_staff', label: 'Missing Staff', count: Array.from(eventHealth.values()).filter(h => h.status === 'needs_staff').length },
    { id: 'at_risk', label: 'At Risk', count: Array.from(eventHealth.values()).filter(h => h.status === 'at_risk').length },
    { id: 'this_week', label: 'This Week', count: events?.filter(e => {
      const date = new Date(e.start_datetime);
      const now = new Date();
      return date >= now && date <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }).length || 0 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Events</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your Paint & Sip events</p>
        </div>
        <Button onClick={() => navigate('/admin/events/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6" style={{ borderColor: 'var(--border-color)' }}>
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent'
              }`}
              style={{ color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-muted)' }}
            >
              {tab.label}
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs" style={{ backgroundColor: 'var(--admin-input-bg)', color: 'var(--text-secondary)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Date Filter */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {savedViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setSavedView(view.id)}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: savedView === view.id ? 'var(--primary-color)' : 'var(--card-bg)',
                borderColor: savedView === view.id ? 'var(--primary-color)' : 'var(--border-color)',
                color: savedView === view.id ? 'white' : 'var(--text-secondary)',
              }}
            >
              {view.label}
              <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: savedView === view.id ? 'rgba(255,255,255,0.2)' : 'var(--admin-input-bg)' }}>
                {view.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <label htmlFor="events-from" className="text-sm" style={{ color: 'var(--text-secondary)' }}>From:</label>
          <input
            id="events-from"
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
          <label htmlFor="events-to" className="text-sm" style={{ color: 'var(--text-secondary)' }}>To:</label>
          <input
            id="events-to"
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
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{tabs.find(t => t.id === activeTab)?.label} Events</CardTitle>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredEvents.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium w-24" style={{ color: 'var(--text-muted)' }}>Image</th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('title')}>
                      Title <SortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('start_datetime')}>
                      Date <SortIcon field="start_datetime" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Venue</th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('base_price_per_seat')}>
                      Price <SortIcon field="base_price_per_seat" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('is_published')}>
                      Status <SortIcon field="is_published" sortField={sortField} sortDirection={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Health</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Fill</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Staff</th>
                    <th className="text-right py-3 px-4 font-medium sticky right-0" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card-bg)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((event) => {
                    const recurrence = getRecurrenceSummary(event);
                    const health = eventHealth.get(event.id) || getEventHealth(event, staffingLookup.get(event.id));
                    return (
                    <tr key={event.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-4">
                        {event.main_image_url ? (
                          <img 
                            src={event.main_image_url} 
                            alt={event.title}
                            className="w-16 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-12 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No img</span>
                          </div>
                        )}
                      </td>
                       <td className="py-3 px-4">
                         <div className="font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                           {event.title}
                           {recurrence && <Badge variant="success" className="text-xs">{recurrence.type}</Badge>}
                         </div>
                         <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{event.slug}</div>
                       </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {formatDateTime(event.start_datetime)}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {event.venue?.name || '-'}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {event.base_price_per_seat
                          ? formatCurrency(event.base_price_per_seat)
                          : 'Free'}
                      </td>
                      <td className="py-3 px-4">
                        {event.is_published ? (
                          <Badge variant="success">Published</Badge>
                        ) : (
                          <Badge variant="gray">Draft</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <Badge variant={health.tone}>{health.label}</Badge>
                          {health.reasons.length > 0 && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{health.reasons.slice(0, 2).join(' · ')}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-32">
                          <div className="h-2 w-20 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                            <div className="h-full rounded-full" style={{
                              width: `${health.fillRate}%`,
                              backgroundColor: health.fillRate < 35 ? '#ef4444' : health.fillRate < 70 ? '#f59e0b' : '#22c55e',
                            }} />
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{health.fillRate}%</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{health.soldSeats}/{event.max_seats || 0} seats</p>
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const si = getStaffingIcon(event.id);
                          return (
                            <span title={si.title}>
                              <Users className="h-4 w-4" style={{ color: si.color }} />
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right sticky right-0" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant={health.status === 'healthy' || health.status === 'complete' ? 'ghost' : 'outline'}
                            size="sm"
                            onClick={() => navigate(health.nextAction.to)}
                          >
                            {health.nextAction.label}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Event"
                            onClick={() => window.open(`/events/${event.slug}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Duplicate Event"
                            onClick={() => handleDuplicate(event)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit event"
                            onClick={() => navigate(`/admin/events/${event.id}`)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete event"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredEvents.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                No events found
              </div>
            )}
            {filteredEvents.length > 0 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredEvents.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
            )}
          </CardContent>
        </Card>
      )}

      <ReasonConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Event"
        message="This moves the event to trash and may affect public listings, staffing, and bookings. Add a reason so the activity log has context."
        reasonLabel="Delete reason"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
        isLoading={trashEvent.isPending}
      />
    </div>
  );
}
