import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Check, CheckCircle2, CreditCard, Gift, Globe, Mail, ShieldCheck, Store, Users } from 'lucide-react';
import { useSettings } from '../../hooks/useAdmin';
import { useProductionReadiness } from '../../hooks/useProductionReadiness';
import { useEvents } from '../../hooks/useEvents';
import { usePrivateEventRequests } from '../../hooks/usePrivateEventRequests';
import { useGiftCards } from '../../hooks/useGiftCards';
import { useEmployees } from '../../hooks/useEmployees';
import type { LucideIcon } from 'lucide-react';

type ManualChecks = Record<string, boolean>;

type LaunchTask = {
  id: string;
  title: string;
  body: string;
  status: 'ready' | 'needs_setup' | 'manual';
  action: string;
  to: string;
  icon: LucideIcon;
  manual?: boolean;
};

const MANUAL_KEY = 'easel_onboarding_manual_checks';

function readManualChecks(): ManualChecks {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    return raw ? JSON.parse(raw) as ManualChecks : {};
  } catch {
    return {};
  }
}

function getSiteSettings(settingsRows: unknown) {
  const rows = Array.isArray(settingsRows) ? settingsRows : [];
  return (rows.find((setting) => setting?.key === 'siteSettings')?.value || {}) as Record<string, string>;
}

export default function LaunchChecklistWidget() {
  const { data: settings } = useSettings();
  const readiness = useProductionReadiness();
  const { data: events = [] } = useEvents();
  const { data: privateRequests = [] } = usePrivateEventRequests();
  const { data: giftCards = [] } = useGiftCards();
  const { data: employees = [] } = useEmployees();
  const [manualChecks, setManualChecks] = useState<ManualChecks>(() => readManualChecks());

  useEffect(() => {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(manualChecks));
  }, [manualChecks]);

  const siteSettings = getSiteSettings(settings);
  const publishedEvents = events.filter((event) => event.is_published);
  const pricedEvents = publishedEvents.filter((event) => Number(event.base_price_per_seat || 0) > 0);
  const hasCheckoutSuccess = typeof window !== 'undefined' && Boolean(localStorage.getItem('checkout_success'));
  const hasBrandBasics = Boolean(siteSettings.siteName && siteSettings.contactEmail);

  const tasks = useMemo<LaunchTask[]>(() => [
    {
      id: 'studio-profile',
      title: 'Studio profile completed',
      body: hasBrandBasics ? 'Site name and contact email are set.' : 'Add studio name, description, and customer contact email.',
      status: hasBrandBasics ? 'ready' : 'needs_setup',
      action: 'Open settings',
      to: '/admin/settings',
      icon: Store,
    },
    {
      id: 'payments-tested',
      title: 'Payment settings tested',
      body: readiness.byId.payments.status === 'ready' ? readiness.byId.payments.detail : 'Connect Stripe and verify checkout credentials before launch.',
      status: readiness.byId.payments.status === 'ready' ? 'ready' : 'needs_setup',
      action: 'Configure payments',
      to: '/admin/settings',
      icon: CreditCard,
    },
    {
      id: 'events-created',
      title: 'First events created',
      body: publishedEvents.length ? `${publishedEvents.length} published event${publishedEvents.length === 1 ? '' : 's'} found.` : 'Create and publish at least one bookable public event.',
      status: publishedEvents.length ? 'ready' : 'needs_setup',
      action: 'Open events',
      to: '/admin/events',
      icon: Calendar,
    },
    {
      id: 'pricing-checked',
      title: 'Pricing checked',
      body: pricedEvents.length ? `${pricedEvents.length} published event${pricedEvents.length === 1 ? ' has' : 's have'} a seat price.` : 'Use event setup to preview guest total and owner net.',
      status: pricedEvents.length ? 'ready' : 'needs_setup',
      action: 'Review event pricing',
      to: '/admin/events',
      icon: ShieldCheck,
    },
    {
      id: 'checkout-tested',
      title: 'Checkout tested',
      body: hasCheckoutSuccess || manualChecks['checkout-tested'] ? 'A checkout test has been marked complete.' : 'Run a test booking from the public event page.',
      status: hasCheckoutSuccess || manualChecks['checkout-tested'] ? 'ready' : 'manual',
      action: 'Browse public events',
      to: '/events',
      icon: Globe,
      manual: true,
    },
    {
      id: 'confirmation-email',
      title: 'Confirmation email tested',
      body: readiness.byId.email_backend.status === 'ready' ? 'Email backend is connected.' : 'Queue a test in Email Center or mark once email delivery is connected.',
      status: readiness.byId.email_backend.status === 'ready' || manualChecks['confirmation-email'] ? 'ready' : 'manual',
      action: 'Open Email Center',
      to: '/admin/email',
      icon: Mail,
      manual: true,
    },
    {
      id: 'private-events-tested',
      title: 'Private request form tested',
      body: privateRequests.length ? `${privateRequests.length} private request${privateRequests.length === 1 ? '' : 's'} found.` : 'Submit a test private event request from the public site.',
      status: privateRequests.length ? 'ready' : 'needs_setup',
      action: 'Test private form',
      to: '/private-events',
      icon: Users,
    },
    {
      id: 'gift-cards',
      title: 'Gift cards configured',
      body: giftCards.length ? `${giftCards.length} gift card record${giftCards.length === 1 ? '' : 's'} found.` : 'Create or test a gift card if gift cards will be part of launch.',
      status: giftCards.length || manualChecks['gift-cards'] ? 'ready' : 'manual',
      action: 'Open gift cards',
      to: '/admin/gift-cards',
      icon: Gift,
      manual: true,
    },
    {
      id: 'staff-roles',
      title: 'Admin roles created',
      body: employees.length ? `${employees.length} employee record${employees.length === 1 ? '' : 's'} found.` : 'Add owner, manager, instructor, and front desk users as needed.',
      status: employees.length ? 'ready' : 'needs_setup',
      action: 'Open employees',
      to: '/admin/employees',
      icon: Users,
    },
    {
      id: 'public-preview',
      title: 'Public site previewed',
      body: manualChecks['public-preview'] ? 'Public calendar and booking pages were reviewed.' : 'Preview public events, private events, gift cards, and checkout on desktop and mobile.',
      status: manualChecks['public-preview'] ? 'ready' : 'manual',
      action: 'Preview site',
      to: '/',
      icon: Globe,
      manual: true,
    },
    {
      id: 'go-live-approved',
      title: 'Go-live approved',
      body: manualChecks['go-live-approved'] ? 'Owner approval is recorded for this browser.' : 'Final owner approval after backend, payment, email, and public pages are ready.',
      status: manualChecks['go-live-approved'] ? 'ready' : 'manual',
      action: 'Review production setup',
      to: '/admin/settings',
      icon: CheckCircle2,
      manual: true,
    },
  ], [employees.length, giftCards.length, hasBrandBasics, hasCheckoutSuccess, manualChecks, pricedEvents.length, privateRequests.length, publishedEvents.length, readiness.byId.email_backend, readiness.byId.payments]);

  const readyCount = tasks.filter((task) => task.status === 'ready').length;
  const progress = Math.round((readyCount / tasks.length) * 100);

  const toggleManual = (id: string) => {
    setManualChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="h-2 rounded-full bg-emerald-500" style={{ width: `${progress}%`, maxWidth: '120px' }} />
          <span className="text-xs font-bold text-slate-500">{readyCount}/{tasks.length}</span>
        </div>
        <span className="text-xs text-slate-400">{progress}%</span>
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.map((task) => {
          const Icon = task.icon;
          const statusColor = task.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : task.status === 'needs_setup' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
          return (
            <div key={task.id} className="flex items-start gap-3 px-5 py-3">
              <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${statusColor}`}>
                {task.status === 'ready' ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <Link to={task.to} className="block text-sm font-semibold text-slate-800 hover:text-orange-600">{task.title}</Link>
                <p className="mt-0.5 text-xs text-slate-500">{task.body}</p>
                <div className="mt-2 flex gap-2">
                  <Link to={task.to} className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700">
                    {task.action} <ArrowRight className="h-3 w-3" />
                  </Link>
                  {task.manual && (
                    <button
                      type="button"
                      onClick={() => toggleManual(task.id)}
                      className={`text-xs font-semibold ${manualChecks[task.id] ? 'text-slate-400' : 'text-emerald-600 hover:text-emerald-700'}`}
                    >
                      {manualChecks[task.id] ? 'Undo' : 'Mark done'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
