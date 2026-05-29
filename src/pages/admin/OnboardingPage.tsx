import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle2, CreditCard, ExternalLink, Gift, Globe, Mail, ShieldCheck, Store, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
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

export default function OnboardingPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const readiness = useProductionReadiness();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: privateRequests = [], isLoading: requestsLoading } = usePrivateEventRequests();
  const { data: giftCards = [], isLoading: giftCardsLoading } = useGiftCards();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
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
      body: readiness.byId.email_backend.status === 'ready' ? 'Email backend is connected.' : 'Queue a test in Email Center or mark this once Jason connects email delivery.',
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
  const needsSetupCount = tasks.filter((task) => task.status === 'needs_setup').length;
  const manualCount = tasks.filter((task) => task.status === 'manual').length;
  const progress = Math.round((readyCount / tasks.length) * 100);
  const loading = settingsLoading || eventsLoading || requestsLoading || giftCardsLoading || employeesLoading;

  const toggleManual = (id: string) => {
    setManualChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Launch Checklist</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track the setup steps that matter before opening the studio site for real customers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/settings"><Button variant="outline">Production Setup</Button></Link>
          <Link to="/"><Button>Preview Public Site</Button></Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Launch progress</p>
              <p className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>{progress}%</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {readyCount} ready · {needsSetupCount} need setup · {manualCount} need owner confirmation
              </p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full lg:max-w-xl" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#16a34a' : 'var(--primary-color)' }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {tasks.map((task) => {
          const Icon = task.icon;
          const statusLabel = task.status === 'ready' ? 'Ready' : task.status === 'needs_setup' ? 'Needs setup' : 'Confirm';
          const badge = task.status === 'ready' ? 'success' : task.status === 'needs_setup' ? 'warning' : 'gray';
          return (
            <Card key={task.id}>
              <CardContent className="flex gap-4 pt-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: task.status === 'ready' ? 'rgba(22, 163, 74, 0.1)' : 'var(--section-bg-light)', color: task.status === 'ready' ? '#16a34a' : 'var(--primary-color)' }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                    <Badge variant={badge}>{statusLabel}</Badge>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{task.body}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={task.to}>
                      <Button variant="outline" size="sm">
                        {task.action}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                    {task.manual && (
                      <Button type="button" variant={manualChecks[task.id] ? 'secondary' : 'outline'} size="sm" onClick={() => toggleManual(task.id)}>
                        {manualChecks[task.id] ? 'Unmark' : 'Mark complete'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backend handoff still required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {readiness.checks.filter((check) => check.status !== 'ready').map((check) => (
            <div key={check.id} className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{check.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{check.detail}</p>
              </div>
              <Link to={check.to}>
                <Button variant="outline" size="sm">
                  Open
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
