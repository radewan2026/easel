import type { Event } from '../types/database';

export type EventHealthStatus = 'healthy' | 'needs_promotion' | 'needs_staff' | 'almost_sold_out' | 'at_risk' | 'complete' | 'draft';

export type EventHealth = {
  status: EventHealthStatus;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'gray' | 'primary';
  fillRate: number;
  soldSeats: number;
  daysUntil: number;
  reasons: string[];
  nextAction: {
    label: string;
    to: string;
  };
};

export function getFillRate(event: Pick<Event, 'max_seats' | 'seats_available'>) {
  const maxSeats = event.max_seats || 0;
  const seatsAvailable = event.seats_available ?? maxSeats;
  const soldSeats = Math.max(0, maxSeats - seatsAvailable);
  return {
    maxSeats,
    soldSeats,
    fillRate: maxSeats > 0 ? Math.round((soldSeats / maxSeats) * 100) : 0,
  };
}

export function getDaysUntil(date: string) {
  const start = new Date(date).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.ceil((start - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getEventHealth(event: Event, staffing?: { total: number; confirmed: number }): EventHealth {
  const { maxSeats, soldSeats, fillRate } = getFillRate(event);
  const daysUntil = getDaysUntil(event.start_datetime);
  const hasStaff = Boolean(staffing?.total);
  const hasVenue = Boolean(event.venue_id || event.venue);
  const reasons: string[] = [];

  if (daysUntil < 0) {
    return {
      status: 'complete',
      label: 'Complete',
      tone: 'gray',
      fillRate,
      soldSeats,
      daysUntil,
      reasons: ['Event date has passed'],
      nextAction: { label: 'Review performance', to: `/admin/events/${event.id}` },
    };
  }

  if (!event.is_published) reasons.push('Draft');
  if (!hasVenue) reasons.push('No venue');
  if (!hasStaff) reasons.push('No staff');
  if (maxSeats > 0 && fillRate < 35 && daysUntil <= 14) reasons.push('Low fill soon');
  if (maxSeats > 0 && fillRate >= 90) reasons.push('Almost sold out');

  if (!event.is_published) {
    return { status: 'draft', label: 'Draft', tone: 'gray', fillRate, soldSeats, daysUntil, reasons, nextAction: { label: 'Publish event', to: `/admin/events/${event.id}` } };
  }
  if (!hasStaff) {
    return { status: 'needs_staff', label: 'Needs Staff', tone: 'warning', fillRate, soldSeats, daysUntil, reasons, nextAction: { label: 'Assign staff', to: `/admin/assignments?eventId=${event.id}&action=assign` } };
  }
  if (!hasVenue || (fillRate < 35 && daysUntil <= 7)) {
    return { status: 'at_risk', label: 'At Risk', tone: 'danger', fillRate, soldSeats, daysUntil, reasons, nextAction: { label: 'Review event', to: `/admin/events/${event.id}` } };
  }
  if (fillRate < 35 && daysUntil <= 21) {
    return { status: 'needs_promotion', label: 'Needs Promotion', tone: 'warning', fillRate, soldSeats, daysUntil, reasons, nextAction: { label: 'Promote', to: '/admin/email' } };
  }
  if (fillRate >= 90) {
    return { status: 'almost_sold_out', label: 'Almost Sold Out', tone: 'primary', fillRate, soldSeats, daysUntil, reasons, nextAction: { label: 'View attendees', to: `/admin/events/${event.id}` } };
  }

  return {
    status: 'healthy',
    label: 'Healthy',
    tone: 'success',
    fillRate,
    soldSeats,
    daysUntil,
    reasons: reasons.length ? reasons : ['Ready'],
    nextAction: { label: 'View event', to: `/admin/events/${event.id}` },
  };
}

export type SetupChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  to: string;
};

export function getSetupChecklist(input: {
  venues?: unknown[];
  events?: unknown[];
  products?: unknown[];
  employees?: unknown[];
  settingsConfigured?: boolean;
}) {
  return [
    { id: 'settings', label: 'Configure studio settings', complete: Boolean(input.settingsConfigured), to: '/admin/settings' },
    { id: 'venue', label: 'Create first venue', complete: Boolean(input.venues?.length), to: '/admin/venues' },
    { id: 'event', label: 'Create first event', complete: Boolean(input.events?.length), to: '/admin/events/new' },
    { id: 'staff', label: 'Add staff', complete: Boolean(input.employees?.length), to: '/admin/employees/new' },
    { id: 'shop', label: 'Add a product or gift-card offer', complete: Boolean(input.products?.length), to: '/admin/products' },
  ] satisfies SetupChecklistItem[];
}

export type StaffReadiness = {
  activeStaff: number;
  adminUsers: number;
  missingRates: number;
  stripeIncomplete: number;
  readinessScore: number;
};

export function getStaffReadiness(employees: Array<{
  status?: string;
  admin_role?: string | null;
  hourly_rate?: number | null;
  stripe_onboarding_complete?: boolean | null;
}>) {
  const active = employees.filter((employee) => employee.status === 'active');
  const missingRates = active.filter((employee) => employee.hourly_rate == null).length;
  const stripeIncomplete = active.filter((employee) => !employee.stripe_onboarding_complete).length;
  const adminUsers = active.filter((employee) => employee.admin_role && employee.admin_role !== 'none').length;
  const issueCount = missingRates + stripeIncomplete;
  const readinessScore = active.length === 0 ? 0 : Math.max(0, Math.round(100 - (issueCount / Math.max(active.length * 2, 1)) * 100));

  return {
    activeStaff: active.length,
    adminUsers,
    missingRates,
    stripeIncomplete,
    readinessScore,
  } satisfies StaffReadiness;
}
