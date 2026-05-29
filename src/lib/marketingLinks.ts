export type TrackingParams = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
};

export type SavedCampaignLink = {
  id: string;
  name: string;
  url: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  createdAt: string;
};

const SAVED_LINKS_STORAGE_KEY = 'easel_marketing_links';
const mergeTagPattern = /\{\{.*?\}\}/;

function cleanParam(value?: string) {
  return value?.trim().replace(/\s+/g, '-').toLowerCase() || '';
}

function trackingEntries(params: TrackingParams) {
  return [
    ['utm_source', cleanParam(params.source)],
    ['utm_medium', cleanParam(params.medium)],
    ['utm_campaign', cleanParam(params.campaign)],
    ['utm_content', cleanParam(params.content)],
    ['utm_term', cleanParam(params.term)],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
}

function appendQueryParams(rawUrl: string, entries: [string, string][]) {
  if (!entries.length) return rawUrl;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}${entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`;
}

export function buildTrackedUrl(rawUrl: string, params: TrackingParams) {
  const url = rawUrl.trim();
  if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) return rawUrl;

  const entries = trackingEntries(params);
  if (!entries.length) return rawUrl;

  if (mergeTagPattern.test(url)) {
    return appendQueryParams(url, entries);
  }

  try {
    const isRelative = url.startsWith('/');
    const parsed = new URL(url, window.location.origin);
    entries.forEach(([key, value]) => parsed.searchParams.set(key, value));
    return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
  } catch {
    return appendQueryParams(url, entries);
  }
}

export function addTrackingToHtmlLinks(html: string, params: TrackingParams) {
  return html.replace(/href="([^"]+)"/g, (_, href: string) => `href="${buildTrackedUrl(href, params)}"`);
}

export function extractHtmlLinks(html: string) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

export function readSavedMarketingLinks() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_LINKS_STORAGE_KEY) || '[]') as SavedCampaignLink[];
  } catch {
    return [];
  }
}

export function writeSavedMarketingLinks(links: SavedCampaignLink[]) {
  localStorage.setItem(SAVED_LINKS_STORAGE_KEY, JSON.stringify(links));
}

export function analyticsHrefForSavedLink(link: Pick<SavedCampaignLink, 'source' | 'medium' | 'campaign'>) {
  const params = new URLSearchParams({
    source: `${link.source}${link.medium ? ` / ${link.medium}` : ''}`,
    campaign: link.campaign || 'No campaign',
    range: 'all',
  });
  return `/admin/analytics?${params.toString()}`;
}

export function absoluteMarketingUrl(url: string) {
  if (url.startsWith('http')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function buildQrImageUrl(url: string, size = 360) {
  const absoluteUrl = absoluteMarketingUrl(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(absoluteUrl)}`;
}
