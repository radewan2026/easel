import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FeatureGate } from '../../components/ui/FeatureGate';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  BarChart3,
  CalendarDays,
  Download,
  Filter,
  Megaphone,
  Mail,
  MousePointerClick,
  RefreshCw,
  Route,
  Search,
  ShoppingCart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { isAnalyticsBackendEnabled, readAnalyticsEvents, readLocalAnalyticsEvents, type AnalyticsEvent } from '../../lib/analytics';
import { exportToCsv } from '../../lib/export';
import { analyticsHrefForSavedLink, readSavedMarketingLinks, type SavedCampaignLink } from '../../lib/marketingLinks';
import { formatCurrency } from '../../lib/utils';

type DateRange = '7d' | '30d' | '90d' | 'all';
type UserTypeFilter = 'all' | AnalyticsEvent['userType'];
const RECOVERY_DRAFT_STORAGE_KEY = 'easel_recovery_campaign_draft';

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function groupCount<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(record: Record<string, number>, limit = 8) {
  return Object.entries(record).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getAttributionSource(event: AnalyticsEvent) {
  const attribution = event.properties.attribution;
  if (!isRecord(attribution)) return 'Direct / unknown';

  const source = typeof attribution.source === 'string' ? attribution.source : '';
  const medium = typeof attribution.medium === 'string' ? attribution.medium : '';
  return source ? `${source}${medium ? ` / ${medium}` : ''}` : 'Direct / unknown';
}

function getAttributionCampaign(event: AnalyticsEvent) {
  const attribution = event.properties.attribution;
  if (!isRecord(attribution)) return 'No campaign';

  const campaign = typeof attribution.campaign === 'string' ? attribution.campaign : '';
  return campaign || 'No campaign';
}

function getEventLabel(event: AnalyticsEvent) {
  if (typeof event.properties.label === 'string' && event.properties.label) return event.properties.label;
  if (typeof event.properties.formName === 'string' && event.properties.formName) return event.properties.formName;
  return event.path;
}

function getEventDate(event: AnalyticsEvent) {
  const timestamp = Date.parse(event.occurredAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getStringProperty(event: AnalyticsEvent, key: string) {
  const value = event.properties[key];
  return typeof value === 'string' ? value : '';
}

function getNumberProperty(event: AnalyticsEvent, key: string) {
  const value = event.properties[key];
  return typeof value === 'number' ? value : 0;
}

function rangeStart(range: DateRange) {
  if (range === 'all') return 0;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.getTime();
}

function getPathGroup(path: string) {
  if (path.startsWith('/checkout')) return 'Checkout';
  if (path.startsWith('/events')) return 'Events';
  if (path.startsWith('/private-events')) return 'Private events';
  if (path.startsWith('/account')) return 'Customer account';
  if (path.startsWith('/admin')) return 'Admin';
  if (path.startsWith('/shop') || path.startsWith('/product')) return 'Shop';
  return 'Other';
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

const CHART_COLORS = ['#eb6a3d', '#2563eb', '#16a34a', '#9333ea', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function buildDailyTimeline(events: AnalyticsEvent[]) {
  const days: Record<string, { date: string; views: number; clicks: number; checkouts: number; conversions: number }> = {};
  for (const event of events) {
    const key = toDateKey(event.occurredAt);
    if (!days[key]) days[key] = { date: key, views: 0, clicks: 0, checkouts: 0, conversions: 0 };
    if (event.eventName === 'page_view') days[key].views += 1;
    else if (event.eventName === 'ui_click' || event.eventName.endsWith('_click')) days[key].clicks += 1;
    else if (event.eventName === 'checkout_start') days[key].checkouts += 1;
    else if (event.eventName === 'checkout_complete' || event.eventName === 'private_request_complete') days[key].conversions += 1;
  }
  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
}

function getRevenueBySource(checkoutCompletions: AnalyticsEvent[]) {
  const sourceRevenue: Record<string, { revenue: number; count: number }> = {};
  for (const event of checkoutCompletions) {
    const source = getAttributionSource(event);
    const total = getNumberProperty(event, 'totalAmount') || getNumberProperty(event, 'total_amount') || 0;
    if (!sourceRevenue[source]) sourceRevenue[source] = { revenue: 0, count: 0 };
    sourceRevenue[source].revenue += total;
    sourceRevenue[source].count += 1;
  }
  return Object.entries(sourceRevenue)
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
}

export default function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState(() => readLocalAnalyticsEvents());
  const [savedLinks, setSavedLinks] = useState<SavedCampaignLink[]>(() => readSavedMarketingLinks());
  const [dataSource, setDataSource] = useState<'local' | 'backend'>(() => (isAnalyticsBackendEnabled() ? 'backend' : 'local'));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const value = searchParams.get('range');
    return value === '7d' || value === '30d' || value === '90d' || value === 'all' ? value : '30d';
  });
  const [userType, setUserType] = useState<UserTypeFilter>(() => {
    const value = searchParams.get('audience');
    return value === 'public' || value === 'customer' || value === 'admin' ? value : 'all';
  });
  const [eventName, setEventName] = useState(() => searchParams.get('event') || 'all');
  const [source, setSource] = useState(() => searchParams.get('source') || 'all');
  const [campaign, setCampaign] = useState(() => searchParams.get('campaign') || 'all');

  const refreshEvents = async () => {
    setIsLoading(true);
    const result = await readAnalyticsEvents();
    setEvents(result.events);
    setSavedLinks(readSavedMarketingLinks());
    setDataSource(result.source);
    setLoadError(result.error || null);
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      const result = await readAnalyticsEvents();
      if (cancelled) return;
      setEvents(result.events);
      setSavedLinks(readSavedMarketingLinks());
      setDataSource(result.source);
      setLoadError(result.error || null);
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const start = rangeStart(dateRange);
    const filteredEvents = events.filter((event) => {
      if (getEventDate(event) < start) return false;
      if (userType !== 'all' && event.userType !== userType) return false;
      if (eventName !== 'all' && event.eventName !== eventName) return false;
      if (source !== 'all' && getAttributionSource(event) !== source) return false;
      if (campaign !== 'all' && getAttributionCampaign(event) !== campaign) return false;
      return true;
    });

    const pageViews = filteredEvents.filter((event) => event.eventName === 'page_view');
    const clicks = filteredEvents.filter((event) => event.eventName === 'ui_click' || event.eventName.endsWith('_click'));
    const formStarts = filteredEvents.filter((event) => event.eventName === 'form_start');
    const formSubmits = filteredEvents.filter((event) => event.eventName === 'form_submit');
    const checkoutSubmits = filteredEvents.filter((event) => event.eventName === 'checkout_submit');
    const checkoutCompletions = filteredEvents.filter((event) => event.eventName === 'checkout_complete');
    const checkoutStarts = filteredEvents.filter((event) => event.eventName === 'checkout_start');
    const checkoutAbandons = filteredEvents.filter((event) => event.eventName === 'checkout_abandoned');
    const privateRequestSubmits = filteredEvents.filter((event) => event.eventName === 'private_request_submit');
    const privateRequestCompletions = filteredEvents.filter((event) => event.eventName === 'private_request_complete');
    const uniqueVisitors = new Set(filteredEvents.map((event) => event.anonymousId)).size;
    const backendSynced = filteredEvents.filter((event) => event.synced).length;
    const publicViews = pageViews.filter((event) => event.userType === 'public');
    const adminViews = pageViews.filter((event) => event.userType === 'admin');
    const checkoutViews = pageViews.filter((event) => event.path.startsWith('/checkout')).length;
    const eventDetailViews = pageViews.filter((event) => event.path.startsWith('/events/')).length;
    const privateEventViews = pageViews.filter((event) => event.path.startsWith('/private-events')).length;
    const pathGroups = topEntries(groupCount(pageViews.map((event) => getPathGroup(event.path))), 6);

    return {
      filteredEvents,
      pageViews,
      clicks,
      formStarts,
      formSubmits,
      uniqueVisitors,
      backendSynced,
      publicViews,
      adminViews,
      checkoutViews,
      eventDetailViews,
      privateEventViews,
      checkoutSubmits,
      checkoutCompletions,
      checkoutStarts,
      checkoutAbandons,
      privateRequestSubmits,
      privateRequestCompletions,
      topPages: topEntries(groupCount(pageViews.map((event) => event.path))),
      topClicks: topEntries(groupCount(clicks.map(getEventLabel))),
      topForms: topEntries(groupCount([...formStarts, ...formSubmits].map(getEventLabel))),
      topSources: topEntries(groupCount(filteredEvents.map(getAttributionSource))),
      topCampaigns: topEntries(groupCount(filteredEvents.map(getAttributionCampaign))),
      pathGroups,
      eventToCheckoutRate: eventDetailViews ? checkoutViews / eventDetailViews : 0,
      checkoutCompletionRate: checkoutSubmits.length ? checkoutCompletions.length / checkoutSubmits.length : 0,
      checkoutStartCompletionRate: checkoutStarts.length ? checkoutCompletions.length / checkoutStarts.length : 0,
      abandonedCheckoutValue: checkoutAbandons.reduce((sum, event) => sum + getNumberProperty(event, 'amountDue'), 0),
      privateFormStartRate: privateEventViews ? formStarts.filter((event) => event.path.startsWith('/private-events')).length / privateEventViews : 0,
      privateRequestCompletionRate: privateRequestSubmits.length ? privateRequestCompletions.length / privateRequestSubmits.length : 0,

      // Time-series data for charts
      dailyEventTimeline: buildDailyTimeline(filteredEvents),

      // Funnel data
      funnelData: [
        { name: 'Page views', value: pageViews.length, fill: '#eb6a3d' },
        { name: 'Checkout starts', value: checkoutStarts.length, fill: '#2563eb' },
        { name: 'Checkout submits', value: checkoutSubmits.length, fill: '#16a34a' },
        { name: 'Checkout complete', value: checkoutCompletions.length, fill: '#9333ea' },
      ],

      // Source revenue attribution
      revenueBySource: getRevenueBySource(checkoutCompletions),
      emailClickConversions: filteredEvents.filter((e) => e.eventName === 'email_link_click').length,
    };
  }, [campaign, dateRange, eventName, events, source, userType]);

  const filterOptions = useMemo(() => ({
    eventNames: Array.from(new Set(events.map((event) => event.eventName))).sort(),
    sources: Array.from(new Set(events.map(getAttributionSource))).sort(),
    campaigns: Array.from(new Set(events.map(getAttributionCampaign))).sort(),
  }), [events]);

  const savedLinkPerformance = useMemo(() => savedLinks.map((link) => {
    const matchingEvents = events.filter((event) => (
      getAttributionSource(event) === `${link.source}${link.medium ? ` / ${link.medium}` : ''}` &&
      getAttributionCampaign(event) === (link.campaign || 'No campaign')
    ));
    const visits = matchingEvents.filter((event) => event.eventName === 'page_view').length;
    const checkouts = matchingEvents.filter((event) => event.eventName === 'checkout_complete').length;
    const privateLeads = matchingEvents.filter((event) => event.eventName === 'private_request_complete').length;
    const conversions = checkouts + privateLeads;
    return {
      link,
      visits,
      conversions,
      conversionRate: visits ? conversions / visits : 0,
    };
  }).sort((a, b) => b.conversions - a.conversions || b.visits - a.visits), [events, savedLinks]);

  const abandonedRecoveryRows = useMemo(() => {
    const completedKeys = new Set(metrics.filteredEvents
      .filter((event) => event.eventName === 'checkout_complete')
      .map((event) => `${event.sessionId}:${getStringProperty(event, 'eventId')}`));

    return metrics.checkoutAbandons
      .filter((event) => !completedKeys.has(`${event.sessionId}:${getStringProperty(event, 'eventId')}`))
      .sort((a, b) => getEventDate(b) - getEventDate(a))
      .slice(0, 12);
  }, [metrics.checkoutAbandons, metrics.filteredEvents]);

  const statCards = [
    { label: 'Page views', value: metrics.pageViews.length.toLocaleString(), detail: `${metrics.uniqueVisitors} ${dataSource === 'backend' ? 'visitors' : 'local visitors'}`, icon: Route },
    { label: 'Tracked clicks', value: metrics.clicks.length.toLocaleString(), detail: 'Buttons and links', icon: MousePointerClick },
    { label: 'Conversions', value: (metrics.checkoutCompletions.length + metrics.privateRequestCompletions.length).toLocaleString(), detail: `${metrics.checkoutCompletions.length} checkouts, ${metrics.privateRequestCompletions.length} private leads`, icon: Activity },
    { label: 'Abandoned checkout', value: metrics.checkoutAbandons.length.toLocaleString(), detail: `${formatCurrency(metrics.abandonedCheckoutValue)} potential recovery`, icon: AlertTriangle },
    {
      label: dataSource === 'backend' ? 'Backend data' : 'Backend sync',
      value: dataSource === 'backend' ? 'Live' : formatPercent(metrics.filteredEvents.length ? metrics.backendSynced / metrics.filteredEvents.length : 0),
      detail: dataSource === 'backend' ? 'Reading from analytics_events' : 'Local sample until analytics_events is enabled',
      icon: BarChart3,
    },
  ];

  const insightCards = [
    {
      title: 'Checkout drop-off',
      value: formatPercent(1 - metrics.checkoutStartCompletionRate),
      detail: metrics.checkoutStarts.length ? `${metrics.checkoutStarts.length - metrics.checkoutCompletions.length} checkout starts did not complete` : 'No checkout starts captured',
    },
    {
      title: 'Private lead capture',
      value: formatPercent(metrics.privateRequestCompletionRate),
      detail: metrics.privateRequestSubmits.length ? `${metrics.privateRequestCompletions.length} received from ${metrics.privateRequestSubmits.length} submits` : 'No private request submits captured',
    },
    {
      title: 'Best source',
      value: metrics.topSources[0]?.[0] || 'No source yet',
      detail: metrics.topSources[0] ? `${metrics.topSources[0][1]} tracked events` : 'Add UTM links to campaigns',
    },
  ];

  const exportAnalytics = () => {
    exportToCsv(metrics.filteredEvents.map((event) => ({
      occurredAt: event.occurredAt,
      eventName: event.eventName,
      userType: event.userType,
      path: event.path,
      source: getAttributionSource(event),
      campaign: getAttributionCampaign(event),
      label: getEventLabel(event),
      anonymousId: event.anonymousId,
      sessionId: event.sessionId,
      synced: event.synced ? 'yes' : 'no',
    })), `frontend-analytics-${dateRange}`);
  };

  const prepareRecoveryDraft = () => {
    const recipientCount = new Set(abandonedRecoveryRows.map((event) => (
      getStringProperty(event, 'purchaserEmail') || event.userEmail || ''
    ).toLowerCase()).filter(Boolean)).size;
    const topEvent = abandonedRecoveryRows[0];
    const eventTitle = topEvent ? getStringProperty(topEvent, 'eventTitle') || 'your paint night' : '{{event_title}}';
    localStorage.setItem(RECOVERY_DRAFT_STORAGE_KEY, JSON.stringify({
      name: 'Abandoned checkout recovery',
      subject: `Still thinking about ${eventTitle}?`,
      recipientCount,
      source: 'analytics',
      body: `Hi {{first_name}},

You started booking {{event_title}}, but your seats are not reserved yet.

If you still want to join us, finish your booking here:
{{checkout_url}}

Need help before booking? Reply to this email and we will help you out.

See you at the studio,
{{studio_name}}`,
    }));
  };

  return (
    <FeatureGate feature="analytics" showUpgradeCard upgradeTitle="Analytics Dashboard" upgradeDescription="Upgrade to Growth or Pro to access the analytics dashboard with page views, click tracking, and customer journey signals.">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Frontend Analytics</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Page views, clicks, form starts, and customer journey signals from {dataSource === 'backend' ? 'Supabase analytics_events' : 'this browser'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportAnalytics} disabled={metrics.filteredEvents.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={refreshEvents} disabled={isLoading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {loadError && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Analytics backend fallback</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Supabase analytics is enabled, but the backend read failed, so this page is showing local browser data. {loadError}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              <CalendarDays className="h-4 w-4" />
              Date range
            </span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All local data</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Filter className="h-4 w-4" />
              Audience
            </span>
            <select value={userType} onChange={(event) => setUserType(event.target.value as UserTypeFilter)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="all">All audiences</option>
              <option value="public">Public site</option>
              <option value="customer">Customer account</option>
              <option value="admin">Admin app</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Search className="h-4 w-4" />
              Event type
            </span>
            <select value={eventName} onChange={(event) => setEventName(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="all">All event types</option>
              {filterOptions.eventNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Route className="h-4 w-4" />
              Source
            </span>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="all">All sources</option>
              {source !== 'all' && !filterOptions.sources.includes(source) && (
                <option value={source}>{source}</option>
              )}
              {filterOptions.sources.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Megaphone className="h-4 w-4" />
              Campaign
            </span>
            <select value={campaign} onChange={(event) => setCampaign(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="all">All campaigns</option>
              {campaign !== 'all' && !filterOptions.campaigns.includes(campaign) && (
                <option value={campaign}>{campaign}</option>
              )}
              {filterOptions.campaigns.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {metrics.filteredEvents.length.toLocaleString()} of {events.length.toLocaleString()} {dataSource === 'backend' ? 'backend' : 'local'} analytics events.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-4 pt-5">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{detail}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--admin-input-bg)', color: 'var(--primary-color)' }}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {insightCards.map((insight) => (
          <Card key={insight.title}>
            <CardContent className="pt-5">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{insight.title}</p>
              <p className="mt-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{insight.value}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{insight.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Abandoned Checkout Recovery</CardTitle>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Captures customers who interacted with checkout and left before completing a booking.
              </p>
            </div>
            <Link to="/admin/email" onClick={prepareRecoveryDraft}>
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Draft recovery email
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {abandonedRecoveryRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              No abandoned checkout opportunities in the current filters. Once a guest enters checkout details and leaves before completion, they will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                <thead>
                  <tr>
                    {['Event', 'Customer', 'Seats', 'Amount', 'Source', 'Last seen', ''].map((heading) => (
                      <th key={heading} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {abandonedRecoveryRows.map((event) => {
                    const email = getStringProperty(event, 'purchaserEmail') || event.userEmail || '';
                    const eventTitle = getStringProperty(event, 'eventTitle') || 'Event checkout';
                    const eventSlug = getStringProperty(event, 'eventSlug');
                    return (
                      <tr key={event.id}>
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-2">
                            <ShoppingCart className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--primary-color)' }} />
                            <div className="min-w-0">
                              <p className="max-w-xs truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{eventTitle}</p>
                              <p className="max-w-xs truncate text-xs" style={{ color: 'var(--text-muted)' }}>{eventSlug || event.path}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{getStringProperty(event, 'purchaserName') || 'Unknown guest'}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{email || 'Email not captured'}</p>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{getNumberProperty(event, 'quantity') || '-'}</td>
                        <td className="px-3 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(getNumberProperty(event, 'amountDue'))}</td>
                        <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{getAttributionSource(event)}</td>
                        <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateLabel(event.occurredAt)}</td>
                        <td className="px-3 py-3 text-right">
                          {email ? (
                            <a href={`mailto:${email}?subject=${encodeURIComponent(`Complete your ${eventTitle} booking`)}&body=${encodeURIComponent(`Hi ${getStringProperty(event, 'purchaserName') || 'there'},\n\nWe noticed you started booking ${eventTitle} but did not finish checkout. If you still want those seats, you can come back here:\n\n${window.location.origin}/checkout/${eventSlug || ''}?quantity=${getNumberProperty(event, 'quantity') || 1}\n\nLet us know if we can help.\n\nEasel Paint & Sip`)}`}>
                              <Button variant="outline" size="sm">Email</Button>
                            </a>
                          ) : (
                            <Button variant="outline" size="sm" disabled>No email</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Customer Funnels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Event detail to checkout</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatPercent(metrics.eventToCheckoutRate)}</strong>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.min(metrics.eventToCheckoutRate * 100, 100)}%`, backgroundColor: 'var(--primary-color)' }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Checkout submit to complete</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatPercent(metrics.checkoutCompletionRate)}</strong>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.min(metrics.checkoutCompletionRate * 100, 100)}%`, backgroundColor: '#2563eb' }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Private page to form start</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatPercent(metrics.privateFormStartRate)}</strong>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.min(metrics.privateFormStartRate * 100, 100)}%`, backgroundColor: '#16a34a' }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Private submit to received</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatPercent(metrics.privateRequestCompletionRate)}</strong>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.min(metrics.privateRequestCompletionRate * 100, 100)}%`, backgroundColor: '#9333ea' }} />
              </div>
            </div>
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}>
              {dataSource === 'backend'
                ? 'This report is reading from Supabase. Server-side rollups can make larger date ranges faster.'
                : 'This is local sample data for QA. Jason can apply the analytics schema so it becomes a cross-device owner report.'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['Public site', metrics.publicViews.length],
              ['Admin app', metrics.adminViews.length],
              ['Checkout views', metrics.checkoutViews],
              ['Checkout starts', metrics.checkoutStarts.length],
              ['Abandoned checkouts', metrics.checkoutAbandons.length],
              ['Checkout completions', metrics.checkoutCompletions.length],
              ['Private-event views', metrics.privateEventViews],
              ['Private request leads', metrics.privateRequestCompletions.length],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.revenueBySource.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No checkout completions with revenue data. Revenue attribution populates when checkout events include totalAmount.</p>
            ) : (
              <div className="space-y-3">
                {metrics.revenueBySource.map(({ source, revenue, count }, index) => (
                  <div key={source}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        {source}
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(revenue)} ({count})</strong>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min((revenue / Math.max(metrics.revenueBySource[0].revenue, 1)) * 100, 100)}%`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}>
                  Total attributed: {formatCurrency(metrics.revenueBySource.reduce((sum, r) => sum + r.revenue, 0))} from {metrics.revenueBySource.reduce((sum, r) => sum + r.count, 0)} conversions.
                  Email link clicks in period: {metrics.emailClickConversions}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Event Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.dailyEventTimeline.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No time-series data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.dailyEventTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="#eb6a3d" strokeWidth={2} dot={false} name="Page views" />
                  <Line type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} dot={false} name="Clicks" />
                  <Line type="monotone" dataKey="conversions" stroke="#16a34a" strokeWidth={2} dot={false} name="Conversions" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={120} />
                <Tooltip />
                <Bar dataKey="value" name="Count">
                  {metrics.funnelData.map((entry, _) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {[
          ['Top Pages', metrics.topPages],
          ['Top Clicks', metrics.topClicks],
          ['Top Forms', metrics.topForms],
          ['Top Sources', metrics.topSources],
          ['Top Campaigns', metrics.topCampaigns],
        ].map(([title, rows]) => (
          <Card key={title as string}>
            <CardHeader>
              <CardTitle>{title as string}</CardTitle>
            </CardHeader>
            <CardContent>
              {(rows as [string, number][]).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data captured yet.</p>
              ) : (
                <div className="space-y-2">
                  {(rows as [string, number][]).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="truncate text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {count}
                        <ArrowDownRight className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Saved Link Performance</CardTitle>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Compares saved Marketing Center links by matching source and campaign attribution.</p>
            </div>
            <Link to="/admin/marketing">
              <Button variant="outline">
                <Megaphone className="mr-2 h-4 w-4" />
                Manage links
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {savedLinkPerformance.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              No saved campaign links yet. Create QR, social, partner, or ad links in Marketing Center to compare them here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                <thead>
                  <tr>
                    {['Link', 'Source', 'Campaign', 'Visits', 'Conversions', 'Rate', ''].map((heading) => (
                      <th key={heading} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {savedLinkPerformance.map(({ link, visits, conversions, conversionRate }) => (
                    <tr key={link.id}>
                      <td className="px-3 py-3">
                        <p className="max-w-xs truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{link.name}</p>
                        <p className="max-w-xs truncate text-xs" style={{ color: 'var(--text-muted)' }}>{link.url}</p>
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{link.source} / {link.medium}</td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{link.campaign || 'No campaign'}</td>
                      <td className="px-3 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{visits}</td>
                      <td className="px-3 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{conversions}</td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatPercent(conversionRate)}</td>
                      <td className="px-3 py-3 text-right">
                        <Link to={analyticsHrefForSavedLink(link)}>
                          <Button variant="outline" size="sm">Analyze</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Journey Areas</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.pathGroups.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No page-view groups captured yet.</p>
            ) : (
              <div className="space-y-2">
                {metrics.pathGroups.map(([label, count]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.min((count / Math.max(metrics.pageViews.length, 1)) * 100, 100)}%`, backgroundColor: 'var(--primary-color)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.filteredEvents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matching events captured yet.</p>
            ) : (
              <div className="max-h-80 overflow-auto">
                <div className="space-y-2">
                  {metrics.filteredEvents.slice(0, 12).map((event) => (
                    <div key={event.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm" style={{ color: 'var(--text-primary)' }}>{event.eventName}</strong>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateLabel(event.occurredAt)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>{event.path}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{event.userType} | {getAttributionSource(event)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </FeatureGate>
  );
}
