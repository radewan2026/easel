import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Download, FileText, LifeBuoy, Mail, ShieldAlert } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { useEvents, useOrders } from '../../hooks/useEvents';
import { useGiftCards } from '../../hooks/useGiftCards';
import { usePrivateEventRequests } from '../../hooks/usePrivateEventRequests';
import { useProductOrders } from '../../hooks/useProducts';
import { useWaitlist } from '../../hooks/useWaitlist';
import { exportData } from '../../lib/export';
import { formatDateTime } from '../../lib/utils';

type SupportSeverity = 'revenue_blocker' | 'time_sensitive' | 'normal';
type SupportStatus = 'open' | 'in_review' | 'resolved';

type SupportCase = {
  id: string;
  category: string;
  severity: SupportSeverity;
  subject: string;
  details: string;
  contextPath: string;
  status: SupportStatus;
  createdAt: string;
};

const SUPPORT_CASES_KEY = 'easel_support_cases';

const categoryOptions = [
  { value: 'booking_checkout', label: 'Booking / checkout issue' },
  { value: 'payment_payout', label: 'Payment / payout issue' },
  { value: 'live_event', label: 'Live event issue' },
  { value: 'private_event', label: 'Private event issue' },
  { value: 'import_onboarding', label: 'Import / onboarding issue' },
  { value: 'general', label: 'General question' },
];

const severityOptions = [
  { value: 'revenue_blocker', label: 'Revenue blocker' },
  { value: 'time_sensitive', label: 'Time-sensitive' },
  { value: 'normal', label: 'Normal' },
];

const statusVariant: Record<SupportStatus, 'warning' | 'gray' | 'success'> = {
  open: 'warning',
  in_review: 'gray',
  resolved: 'success',
};

function readCases(): SupportCase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUPPORT_CASES_KEY);
    return raw ? JSON.parse(raw) as SupportCase[] : [];
  } catch {
    return [];
  }
}

function caseId() {
  return `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SupportCenterPage() {
  const { showToast } = useToast();
  const { data: events = [] } = useEvents();
  const { data: orders = [] } = useOrders();
  const { data: giftCards = [] } = useGiftCards();
  const { data: privateRequests = [] } = usePrivateEventRequests();
  const { data: productOrders = [] } = useProductOrders();
  const { data: waitlist = [] } = useWaitlist();
  const [cases, setCases] = useState<SupportCase[]>(() => readCases());
  const [form, setForm] = useState({
    category: 'booking_checkout',
    severity: 'normal' as SupportSeverity,
    subject: '',
    details: '',
    contextPath: typeof window !== 'undefined' ? window.location.pathname : '/admin/support',
  });

  useEffect(() => {
    localStorage.setItem(SUPPORT_CASES_KEY, JSON.stringify(cases));
  }, [cases]);

  const customerExport = useMemo(() => {
    const rows = new Map<string, Record<string, unknown>>();
    orders.forEach((order) => {
      const key = order.purchaser_email.toLowerCase();
      const current = rows.get(key) || { email: order.purchaser_email, name: order.purchaser_name, eventOrders: 0, seats: 0, eventSpend: 0, productOrders: 0, giftCards: 0, waitlistEntries: 0 };
      current.eventOrders = Number(current.eventOrders) + 1;
      current.seats = Number(current.seats) + order.total_seats;
      current.eventSpend = Number(current.eventSpend) + order.total_amount;
      rows.set(key, current);
    });
    productOrders.forEach((order) => {
      const key = order.purchaser_email.toLowerCase();
      const current = rows.get(key) || { email: order.purchaser_email, name: order.purchaser_name, eventOrders: 0, seats: 0, eventSpend: 0, productOrders: 0, giftCards: 0, waitlistEntries: 0 };
      current.productOrders = Number(current.productOrders) + 1;
      rows.set(key, current);
    });
    giftCards.forEach((card) => {
      const key = card.purchaser_email.toLowerCase();
      const current = rows.get(key) || { email: card.purchaser_email, name: card.purchaser_name, eventOrders: 0, seats: 0, eventSpend: 0, productOrders: 0, giftCards: 0, waitlistEntries: 0 };
      current.giftCards = Number(current.giftCards) + 1;
      rows.set(key, current);
    });
    waitlist.forEach((entry) => {
      const key = entry.email.toLowerCase();
      const current = rows.get(key) || { email: entry.email, name: entry.name, eventOrders: 0, seats: 0, eventSpend: 0, productOrders: 0, giftCards: 0, waitlistEntries: 0 };
      current.waitlistEntries = Number(current.waitlistEntries) + 1;
      rows.set(key, current);
    });
    return Array.from(rows.values());
  }, [giftCards, orders, productOrders, waitlist]);

  const exports = [
    {
      label: 'Customers',
      count: customerExport.length,
      filename: 'easel-customers-export',
      data: customerExport,
    },
    {
      label: 'Events',
      count: events.length,
      filename: 'easel-events-export',
      data: events.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        start: event.start_datetime,
        price: event.base_price_per_seat,
        maxSeats: event.max_seats,
        seatsAvailable: event.seats_available,
        published: event.is_published,
      })),
    },
    {
      label: 'Orders',
      count: orders.length,
      filename: 'easel-orders-export',
      data: orders.map((order) => ({
        id: order.id,
        event: order.event?.title,
        purchaser: order.purchaser_name,
        email: order.purchaser_email,
        seats: order.total_seats,
        total: order.total_amount,
        status: order.status,
        createdAt: order.created_at,
      })),
    },
    {
      label: 'Attendees',
      count: orders.reduce((sum, order) => sum + (order.attendees?.length || 0), 0),
      filename: 'easel-attendees-export',
      data: orders.flatMap((order) => (order.attendees || []).map((attendee) => ({
        id: attendee.id,
        name: attendee.full_name,
        email: attendee.email,
        event: order.event?.title,
        orderId: order.id,
        orderStatus: order.status,
      }))),
    },
    {
      label: 'Gift cards',
      count: giftCards.length,
      filename: 'easel-gift-cards-export',
      data: giftCards.map((card) => ({
        id: card.id,
        code: card.code,
        amount: card.amount,
        purchaser: card.purchaser_name,
        purchaserEmail: card.purchaser_email,
        recipient: card.recipient_name,
        recipientEmail: card.recipient_email,
        redeemed: card.is_redeemed,
      })),
    },
    {
      label: 'Private requests',
      count: privateRequests.length,
      filename: 'easel-private-requests-export',
      data: privateRequests.map((request) => ({
        id: request.id,
        contact: request.contact_name,
        email: request.contact_email,
        phone: request.contact_phone,
        eventType: request.event_type,
        preferredDate: request.preferred_date,
        guests: request.guest_count,
        status: request.status,
      })),
    },
  ];

  const submitCase = () => {
    if (!form.subject.trim() || !form.details.trim()) {
      showToast('Add a subject and details before creating the support case.', 'error');
      return;
    }

    const nextCase: SupportCase = {
      id: caseId(),
      category: form.category,
      severity: form.severity,
      subject: form.subject.trim(),
      details: form.details.trim(),
      contextPath: form.contextPath.trim() || '/admin/support',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setCases((prev) => [nextCase, ...prev]);
    setForm((prev) => ({ ...prev, subject: '', details: '' }));
    showToast(form.severity === 'revenue_blocker' ? 'Revenue blocker case created.' : 'Support case created.');
  };

  const updateStatus = (id: string, status: SupportStatus) => {
    setCases((prev) => prev.map((supportCase) => supportCase.id === id ? { ...supportCase, status } : supportCase));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Support Center</h1>
          <p style={{ color: 'var(--text-muted)' }}>Report issues, track cases, and export critical business data.</p>
        </div>
        <a href="mailto:support@gonefishinglabs.com?subject=Easel%20Support%20Request">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Email Support
          </Button>
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              <CardTitle>Create Support Case</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                options={categoryOptions}
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              />
              <Select
                label="Severity"
                options={severityOptions}
                value={form.severity}
                onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value as SupportSeverity }))}
              />
            </div>
            <Input
              label="Subject"
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Checkout failed for a customer"
            />
            <Textarea
              label="Details"
              rows={6}
              value={form.details}
              onChange={(event) => setForm((prev) => ({ ...prev, details: event.target.value }))}
              placeholder="What happened, who was affected, and what outcome do you need?"
            />
            <Input
              label="Linked page or object"
              value={form.contextPath}
              onChange={(event) => setForm((prev) => ({ ...prev, contextPath: event.target.value }))}
            />
            {form.severity === 'revenue_blocker' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Revenue blockers should include order/customer email, amount impacted, and whether guests are waiting live.
              </div>
            )}
            <Button onClick={submitCase} className="w-full">
              <ShieldAlert className="mr-2 h-4 w-4" />
              Create Case
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support Cases</CardTitle>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No support cases yet.</p>
            ) : (
              <div className="space-y-3">
                {cases.map((supportCase) => (
                  <div key={supportCase.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{supportCase.subject}</p>
                          <Badge variant={supportCase.severity === 'revenue_blocker' ? 'danger' : supportCase.severity === 'time_sensitive' ? 'warning' : 'gray'}>
                            {severityOptions.find((option) => option.value === supportCase.severity)?.label}
                          </Badge>
                          <Badge variant={statusVariant[supportCase.status]}>{supportCase.status.replace('_', ' ')}</Badge>
                        </div>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{supportCase.details}</p>
                        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {categoryOptions.find((option) => option.value === supportCase.category)?.label} · {supportCase.contextPath} · {formatDateTime(supportCase.createdAt)}
                        </p>
                      </div>
                      <Select
                        options={[
                          { value: 'open', label: 'Open' },
                          { value: 'in_review', label: 'In review' },
                          { value: 'resolved', label: 'Resolved' },
                        ]}
                        value={supportCase.status}
                        onChange={(event) => updateStatus(supportCase.id, event.target.value as SupportStatus)}
                        className="min-w-32"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            <CardTitle>Business Data Export</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {exports.map((item) => (
              <div key={item.label} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>{item.count} records available</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={item.data.length === 0}
                  onClick={() => void exportData(item.data, item.filename, 'csv', item.label)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            <CardTitle>Export And Offboarding Policy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
            <FileText className="mb-3 h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Data access</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Owners should be able to export customer, event, order, attendee, gift card, and private request data at any time.</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
            <AlertTriangle className="mb-3 h-5 w-5" style={{ color: '#d97706' }} />
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue blockers</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Checkout, payout, and live-event blockers should be marked revenue blocker and include linked order/customer context.</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
            <ShieldAlert className="mb-3 h-5 w-5" style={{ color: 'var(--primary-color)' }} />
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Production backend</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Jason should persist support cases server-side, attach screenshots/logs, and route severe cases to the real helpdesk.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
