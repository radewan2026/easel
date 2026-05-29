import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEvents, useVenues } from '../../hooks/useEvents';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { Calendar, List, Grid3X3, ChevronRight, ChevronLeft, MapPin, Search, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import AnimatedText from '../../components/animations/AnimatedText';
import AnimateOnScroll from '../../components/animations/AnimateOnScroll';
import SEO from '../../components/SEO';
import type { Event } from '../../types/database';
import type { EventViewMode } from '../../types/database';
import { useSiteSetting } from '../../hooks/useAdmin';

const MAX_RECENT = 5;

function useRecentlyViewed() {
  const [recent, setRecent] = useState<Event[]>(() => {
    try {
      const stored = localStorage.getItem('recently_viewed_events');
      return stored ? JSON.parse(stored) as Event[] : [];
    } catch (error) {
      /* Unable to load recently viewed events */
      return [];
    }
  });

  const addViewed = (event: Event) => {
    const updated = [event, ...recent.filter(e => e.id !== event.id)].slice(0, MAX_RECENT);
    setRecent(updated);
    try {
      localStorage.setItem('recently_viewed_events', JSON.stringify(updated));
    } catch (error) {
      /* Unable to save recently viewed events */
    }
  };

  return { recent, addViewed };
}

function CalendarView({ events }: { events: Event[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => {
      const eventDate = new Date(e.start_datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const today = new Date().toISOString().split('T')[0];

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="rounded-xl shadow-lg border overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: 'var(--primary-color)' }}>
        <button onClick={prevMonth} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
        <h2 className="text-xl font-bold text-white">{monthNames[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center py-3 text-sm font-semibold" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-muted)' }}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ backgroundColor: 'var(--border-color)' }}>
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} style={{ backgroundColor: 'var(--section-bg-light)' }} className="min-h-[8rem]" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = getEventsForDay(day);
          const isToday = dateStr === today;
          return (
            <div key={day} className={`p-1 ${isToday ? 'ring-2 ring-inset' : ''}`} style={{ backgroundColor: 'var(--card-bg)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: isToday ? 'var(--primary-color)' : 'var(--text-muted)' }}>{day}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <Link key={event.id} to={`/events/${event.slug}`} className="block group">
                    <div className="relative rounded overflow-hidden" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      {event.main_image_url ? (
                        <img src={event.main_image_url} alt={event.title} className="w-full h-28 object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-28 flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                          <Calendar className="h-6 w-6" style={{ color: 'var(--primary-color)' }} />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <p className="text-white text-xs font-medium truncate">
                          {new Date(event.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-medium truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{event.title}</p>
                  </Link>
                ))}
                {dayEvents.length > 2 && <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>+{dayEvents.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [searchParams] = useSearchParams();
  const initialVenue = searchParams.get('venue') || '';
  const { data: events, isLoading } = useEvents({ published: true });
  const { data: venues } = useVenues();
  const { recent } = useRecentlyViewed();
  const showPastEvents = useSiteSetting('showPastEvents', 'false') === 'true';

  const [viewMode, setViewMode] = useState<EventViewMode>('card');
  const [venueFilter, setVenueFilter] = useState(initialVenue);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const upcomingEvents = useMemo(() => (events || []).filter(e => {
    if (showPastEvents) return new Date(e.start_datetime) >= new Date(new Date().setHours(0, 0, 0, 0));
    return new Date(e.start_datetime) > new Date();
  }), [events, showPastEvents]);

  const filteredEvents = useMemo(() => {
    return upcomingEvents.filter(event => {
      if (venueFilter && event.venue_id !== venueFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = event.title?.toLowerCase().includes(q);
        const venueMatch = event.venue?.name?.toLowerCase().includes(q);
        const cityMatch = event.venue?.city?.toLowerCase().includes(q);
        if (!titleMatch && !venueMatch && !cityMatch) return false;
      }

      if (dateFrom) {
        const eventDate = new Date(event.start_datetime);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (eventDate < fromDate) return false;
      }

      if (dateTo) {
        const eventDate = new Date(event.start_datetime);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (eventDate > toDate) return false;
      }

      if (priceMax) {
        const price = event.base_price_per_seat || 0;
        if (price > parseFloat(priceMax)) return false;
      }

      return true;
    });
  }, [upcomingEvents, venueFilter, searchQuery, dateFrom, dateTo, priceMax]);

  const clearFilters = () => {
    setVenueFilter('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPriceMax('');
  };

  const hasActiveFilters = venueFilter || searchQuery || dateFrom || dateTo || priceMax;

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="Events" description="Find a Paint & Sip event near you and book your seats today!" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <AnimatedText text="Events" as="h1" className="text-3xl font-bold mb-2 text-primary-color" animation="slideUp" stagger={70} />
          <AnimatedText text="Find a Paint & Sip event near you and book your seats today!" as="p" className="text-secondary-color" animation="fadeIn" stagger={18} delay={300} />
        </div>

        {/* Recently Viewed */}
        {recent.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Recently Viewed</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recent.map(event => (
                <Link key={event.id} to={`/events/${event.slug}`} className="flex-shrink-0 w-40 group">
                  <div className="aspect-video rounded-lg overflow-hidden mb-1" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    {event.main_image_url ? (
                      <img src={event.main_image_url} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><Calendar className="h-6 w-6" /></div>
                    )}
                  </div>
                  <p className="text-xs font-medium truncate group-hover:text-primary-600" style={{ color: 'var(--text-secondary)' }}>{event.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.venue?.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <Button variant={viewMode === 'card' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('card')}>
              <Grid3X3 className="h-4 w-4 mr-1" />Card
            </Button>
            <Button variant={viewMode === 'list' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4 mr-1" />List
            </Button>
            <Button variant={viewMode === 'calendar' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')}>
              <Calendar className="h-4 w-4 mr-1" />Calendar
            </Button>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events, venues, cities..."
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1">
            <SlidersHorizontal className="h-4 w-4" />
            Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary-color)' }} />}
          </Button>
        </div>

        {showFilters && (
          <div className="border rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ backgroundColor: 'var(--section-bg-light)', borderColor: 'var(--border-color)' }}>
            <Select
              label="Venue"
              options={[{ value: '', label: 'All Venues' }, ...(venues?.map(v => ({ value: v.id, label: v.name })) || [])]}
              value={venueFilter}
              onChange={e => setVenueFilter(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Max Price (per seat)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={e => setPriceMax(e.target.value)}
                  placeholder="Any"
                  className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <X className="h-4 w-4" />Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Showing {filteredEvents.length} of {upcomingEvents.length} events
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No events found matching your criteria.</p>
            {hasActiveFilters && <button onClick={clearFilters} className="mt-2 text-sm" style={{ color: 'var(--primary-color)' }}>Clear filters</button>}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <div key={event.id} className="workshop-card bg-surface-container-lowest rounded-xl overflow-hidden group hover:shadow-2xl transition-all duration-500 border border-surface-container-highest">
                <div className="aspect-[4/5] overflow-hidden relative">
                  {event.main_image_url ? (
                    <img src={event.main_image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-high text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl">palette</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-8">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Workshop</span>
                    <span className="text-sm font-label-md text-on-surface">
                      {event.base_price_per_seat ? formatCurrency(event.base_price_per_seat) : 'Free'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold font-headline-md mb-2 group-hover:text-secondary transition-colors">{event.title}</h3>
                  <p className="text-body-md text-on-surface-variant">{formatDateTime(event.start_datetime)}</p>
                  {event.venue && (
                    <p className="text-sm text-on-surface-variant mt-1 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 inline" /> {event.venue.name}, {event.venue.city}
                    </p>
                  )}
                  <div className="quick-view" />
                  <Link
                    to={`/events/${event.slug}`}
                    className="reserve-btn block w-full mt-6 py-4 border border-tertiary-container text-tertiary-container font-label-md transition-all rounded-lg text-center hover:bg-secondary hover:text-white hover:border-secondary"
                  >
                    Reserve Seat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-4">
            {filteredEvents.map((event, i) => (
              <AnimateOnScroll key={event.id} animation="fade-up" delay={i * 60}>
                <Card className="hover:shadow-lg transition-shadow card-bg border-color" style={{ borderWidth: '1px' }}>
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-48 aspect-video md:aspect-auto relative overflow-hidden" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      {event.main_image_url ? (
                        <img src={event.main_image_url} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><Calendar className="h-8 w-8" /></div>
                      )}
                    </div>
                    <CardContent className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 text-primary-color">{event.title}</h3>
                      <p className="text-sm mb-2 text-secondary-color">{formatDateTime(event.start_datetime)}</p>
                      {event.venue && (
                        <div className="flex items-center text-sm mb-2 text-muted-color"><MapPin className="h-4 w-4 mr-1" />{event.venue.name}, {event.venue.city}</div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>{event.base_price_per_seat ? formatCurrency(event.base_price_per_seat) : 'Free'}/seat</span>
                        <Link to={`/events/${event.slug}`}><Button size="sm">View Details</Button></Link>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        ) : (
          <CalendarView events={filteredEvents} />
        )}
      </div>
    </div>
  );
}
