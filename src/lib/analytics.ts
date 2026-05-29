import { supabase } from './supabase';

const ANALYTICS_STORAGE_KEY = 'easel_analytics_events';
const ANONYMOUS_ID_KEY = 'easel_anonymous_id';
const SESSION_ID_KEY = 'easel_analytics_session_id';
const ATTRIBUTION_STORAGE_KEY = 'easel_attribution';
const MAX_LOCAL_EVENTS = 500;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  path: string;
  title?: string;
  anonymousId: string;
  sessionId: string;
  userType: 'public' | 'customer' | 'admin';
  userEmail?: string | null;
  properties: Record<string, JsonValue>;
  occurredAt: string;
  synced?: boolean;
}

type TrackInput = {
  eventName: string;
  path?: string;
  title?: string;
  userType?: AnalyticsEvent['userType'];
  userEmail?: string | null;
  properties?: Record<string, JsonValue>;
};

type AnalyticsEventRow = {
  id: string;
  event_name: string;
  path: string;
  title: string | null;
  anonymous_id: string;
  session_id: string;
  user_type: AnalyticsEvent['userType'];
  user_email: string | null;
  properties: Record<string, JsonValue> | null;
  occurred_at: string;
};

export type AnalyticsReadResult = {
  events: AnalyticsEvent[];
  source: 'local' | 'backend';
  error?: string;
};

export interface AttributionContext {
  landingPath: string;
  referrer: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  capturedAt: string;
}

let backendUnavailable = false;

function shouldSyncAnalyticsBackend() {
  return import.meta.env.VITE_ANALYTICS_BACKEND_ENABLED === 'true';
}

export function isAnalyticsBackendEnabled() {
  return shouldSyncAnalyticsBackend();
}

function getBrowserId(key: string, prefix: string) {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = `${prefix}_${crypto.randomUUID()}`;
  localStorage.setItem(key, value);
  return value;
}

export function getAnonymousId() {
  return getBrowserId(ANONYMOUS_ID_KEY, 'anon');
}

export function getAnalyticsSessionId() {
  return getBrowserId(SESSION_ID_KEY, 'session');
}

export function readLocalAnalyticsEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AnalyticsEvent[] : [];
  } catch {
    return [];
  }
}

function mapAnalyticsRow(row: AnalyticsEventRow): AnalyticsEvent {
  return {
    id: row.id,
    eventName: row.event_name,
    path: row.path,
    title: row.title || undefined,
    anonymousId: row.anonymous_id,
    sessionId: row.session_id,
    userType: row.user_type,
    userEmail: row.user_email,
    properties: row.properties || {},
    occurredAt: row.occurred_at,
    synced: true,
  };
}

export async function readAnalyticsEvents(limit = 1000): Promise<AnalyticsReadResult> {
  const localEvents = readLocalAnalyticsEvents();

  if (!shouldSyncAnalyticsBackend() || backendUnavailable) {
    return { events: localEvents, source: 'local' };
  }

  const { data, error } = await supabase
    .from('analytics_events')
    .select('id,event_name,path,title,anonymous_id,session_id,user_type,user_email,properties,occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingAnalyticsTable(error)) backendUnavailable = true;
    return {
      events: localEvents,
      source: 'local',
      error: error.message || 'Analytics backend is not available yet.',
    };
  }

  return {
    events: (data || []).map((row) => mapAnalyticsRow(row as AnalyticsEventRow)),
    source: 'backend',
  };
}

function writeLocalAnalyticsEvents(events: AnalyticsEvent[]) {
  localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(events.slice(0, MAX_LOCAL_EVENTS)));
}

function readAttributionFromStorage(): AttributionContext | null {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AttributionContext : null;
  } catch {
    return null;
  }
}

export function getAttributionContext() {
  return readAttributionFromStorage();
}

export function captureAttribution() {
  if (typeof window === 'undefined') return null;

  const current = readAttributionFromStorage();
  const params = new URLSearchParams(window.location.search);
  const hasCampaignParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].some((key) => params.has(key));

  if (current && !hasCampaignParams) return current;

  const attribution: AttributionContext = {
    landingPath: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
    source: params.get('utm_source') || current?.source || null,
    medium: params.get('utm_medium') || current?.medium || null,
    campaign: params.get('utm_campaign') || current?.campaign || null,
    term: params.get('utm_term') || current?.term || null,
    content: params.get('utm_content') || current?.content || null,
    capturedAt: new Date().toISOString(),
  };

  localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  return attribution;
}

function storeLocalEvent(event: AnalyticsEvent) {
  writeLocalAnalyticsEvents([event, ...readLocalAnalyticsEvents()]);
}

function isMissingAnalyticsTable(error: unknown) {
  const backendError = error as { code?: string; message?: string; details?: string } | null;
  const message = `${backendError?.message || ''} ${backendError?.details || ''}`.toLowerCase();
  return backendError?.code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function getElementAnalyticsLabel(element: Element | null) {
  if (!element) return '';
  const explicit = element.getAttribute('data-analytics-label');
  if (explicit) return explicit;
  const aria = element.getAttribute('aria-label');
  if (aria) return aria;
  return normalizeText(element.textContent || element.getAttribute('title') || '');
}

export function inferUserType(pathname = window.location.pathname): AnalyticsEvent['userType'] {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/account')) return 'customer';
  return 'public';
}

export async function trackAnalyticsEvent(input: TrackInput) {
  if (typeof window === 'undefined') return null;

  const event: AnalyticsEvent = {
    id: crypto.randomUUID(),
    eventName: input.eventName,
    path: input.path || `${window.location.pathname}${window.location.search}`,
    title: input.title || document.title,
    anonymousId: getAnonymousId(),
    sessionId: getAnalyticsSessionId(),
    userType: input.userType || inferUserType(input.path || window.location.pathname),
    userEmail: input.userEmail || null,
    properties: {
      attribution: captureAttribution() as unknown as JsonValue,
      ...(input.properties || {}),
    },
    occurredAt: new Date().toISOString(),
    synced: false,
  };

  storeLocalEvent(event);

  if (!shouldSyncAnalyticsBackend() || backendUnavailable) return event;

  const { error } = await supabase
    .from('analytics_events')
    .insert({
      id: event.id,
      event_name: event.eventName,
      path: event.path,
      title: event.title,
      anonymous_id: event.anonymousId,
      session_id: event.sessionId,
      user_type: event.userType,
      user_email: event.userEmail,
      properties: event.properties,
      occurred_at: event.occurredAt,
    });

  if (error) {
    if (isMissingAnalyticsTable(error)) {
      backendUnavailable = true;
      return event;
    }
    return event;
  }

  const updated = readLocalAnalyticsEvents().map((item) => (
    item.id === event.id ? { ...item, synced: true } : item
  ));
  writeLocalAnalyticsEvents(updated);
  return { ...event, synced: true };
}
