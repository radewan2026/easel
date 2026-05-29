import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrders } from '../../hooks/useEvents';
import { useProductOrders } from '../../hooks/useProducts';
import { useGiftCards } from '../../hooks/useGiftCards';
import { useWaitlist } from '../../hooks/useWaitlist';
import { useSubscribers } from '../../hooks/useNewsletter';
import { useSubmissions } from '../../hooks/useSubmissions';
import { useReferrals } from '../../hooks/useReferrals';
import { exportData, type ExportFormat } from '../../lib/export';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CustomerCommunicationHistory } from '../../components/admin/CustomerCommunicationHistory';
import { Download, Eye, Search, Filter, FileText, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Users, ShoppingBag, Gift, Ticket, Mail, Calendar, Star, Package } from 'lucide-react';
import { Pagination } from '../../components/ui/Pagination';
import type { Attendee, GiftCard, Order, NewsletterSubscriber, Referral, Submission, WaitlistEntry, ProductOrder } from '../../types/database';

type SortField = 'name' | 'email' | 'lastInteraction' | 'orders' | 'attendees' | 'productOrders' | 'giftCards' | 'value';
type SortDirection = 'asc' | 'desc';
type CustomerKind = 'customer' | 'attendee' | 'shop_customer' | 'gift_card_buyer' | 'gift_card_recipient' | 'subscriber' | 'waitlist' | 'lead' | 'referrer';
type CustomerSegmentId = 'all' | 'high_value' | 'repeat' | 'lapsed' | 'gift_cards' | 'waitlist' | 'shop_only' | 'newsletter' | 'leads';

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc'
    ? <ArrowUp className="h-4 w-4 ml-1 inline" style={{ color: 'var(--primary-color)' }} />
    : <ArrowDown className="h-4 w-4 ml-1 inline" style={{ color: 'var(--primary-color)' }} />;
}

type CustomerInteraction = {
  id: string;
  type: string;
  date: string;
  title: string;
  subtitle?: string;
  detail?: string;
  amount?: number;
};

type CustomerProfile = {
  key: string;
  name: string;
  email: string;
  firstInteractionAt: string;
  lastInteractionAt: string;
  orders: Order[];
  attendees: { order: Order; attendee: Attendee }[];
  productOrders: ProductOrder[];
  giftCardsPurchased: GiftCard[];
  giftCardsReceived: GiftCard[];
  waitlistEntries: WaitlistEntry[];
  subscribers: NewsletterSubscriber[];
  submissions: Submission[];
  referrals: Referral[];
  interactions: CustomerInteraction[];
  kinds: Set<CustomerKind>;
  sources: Set<string>;
  totalSpend: number;
  totalSeats: number;
  totalValue: number;
};

const EMPTY_PROFILE = (): CustomerProfile => ({
  key: '',
  name: '',
  email: '',
  firstInteractionAt: '',
  lastInteractionAt: '',
  orders: [],
  attendees: [],
  productOrders: [],
  giftCardsPurchased: [],
  giftCardsReceived: [],
  waitlistEntries: [],
  subscribers: [],
  submissions: [],
  referrals: [],
  interactions: [],
  kinds: new Set<CustomerKind>(),
  sources: new Set<string>(),
  totalSpend: 0,
  totalSeats: 0,
  totalValue: 0,
});

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function getDateValue(date: string) {
  const value = new Date(date).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function withinRange(date: string, from: string, to: string) {
  if (!from && !to) return true;
  const time = getDateValue(date);
  if (from && time < getDateValue(from)) return false;
  if (to && time > getDateValue(`${to}T23:59:59`)) return false;
  return true;
}

function labelForKinds(kinds: Set<CustomerKind>) {
  const labels: Record<CustomerKind, string> = {
    customer: 'Event Customer',
    attendee: 'Attendee',
    shop_customer: 'Shop Customer',
    gift_card_buyer: 'Gift Card Buyer',
    gift_card_recipient: 'Gift Card Recipient',
    subscriber: 'Subscriber',
    waitlist: 'Waitlist',
    lead: 'Lead',
    referrer: 'Referrer',
  };
  return Array.from(kinds).map((kind) => labels[kind]);
}

const customerSegments: { id: CustomerSegmentId; label: string; description: string }[] = [
  { id: 'all', label: 'All', description: 'Every customer, lead, buyer, and subscriber' },
  { id: 'high_value', label: 'High Value', description: 'Profiles worth $250 or more' },
  { id: 'repeat', label: 'Repeat', description: 'Multiple orders or attendee records' },
  { id: 'lapsed', label: 'Lapsed', description: 'No interaction in the last 90 days' },
  { id: 'gift_cards', label: 'Gift Cards', description: 'Purchased or received gift cards' },
  { id: 'waitlist', label: 'Waitlist', description: 'People waiting for seats' },
  { id: 'shop_only', label: 'Shop Only', description: 'Shop buyers without event orders' },
  { id: 'newsletter', label: 'Newsletter', description: 'Active newsletter contacts' },
  { id: 'leads', label: 'Leads', description: 'Submissions and inquiries' },
];

function profileMatchesSegment(profile: CustomerProfile, segment: CustomerSegmentId) {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  switch (segment) {
    case 'all':
      return true;
    case 'high_value':
      return profile.totalValue >= 250;
    case 'repeat':
      return profile.orders.length + profile.attendees.length + profile.productOrders.length > 1;
    case 'lapsed':
      return Boolean(profile.lastInteractionAt) && getDateValue(profile.lastInteractionAt) < ninetyDaysAgo;
    case 'gift_cards':
      return profile.giftCardsPurchased.length + profile.giftCardsReceived.length > 0;
    case 'waitlist':
      return profile.waitlistEntries.length > 0;
    case 'shop_only':
      return profile.productOrders.length > 0 && profile.orders.length === 0 && profile.attendees.length === 0;
    case 'newsletter':
      return profile.subscribers.some((subscriber) => subscriber.is_active);
    case 'leads':
      return profile.submissions.length > 0;
  }
}

export default function AdminCustomersPage() {
  const { data: orders, isLoading: ordersLoading } = useOrders();
  const { data: productOrders, isLoading: productOrdersLoading } = useProductOrders();
  const { data: giftCards, isLoading: giftCardsLoading } = useGiftCards();
  const { data: waitlist, isLoading: waitlistLoading } = useWaitlist();
  const { data: subscribers, isLoading: subscribersLoading } = useSubscribers();
  const { data: submissions, isLoading: submissionsLoading } = useSubmissions();
  const { data: referrals, isLoading: referralsLoading } = useReferrals();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeSegment, setActiveSegment] = useState<CustomerSegmentId>('all');
  const [sortField, setSortField] = useState<SortField>('lastInteraction');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const exportRef = useRef<HTMLDivElement>(null);

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

  const allProfiles = useMemo(() => {
    const map = new Map<string, CustomerProfile>();

    const ensureProfile = (key: string, name: string, email: string) => {
      if (!map.has(key)) {
        map.set(key, {
          ...EMPTY_PROFILE(),
          key,
          name,
          email,
        });
      }
      const profile = map.get(key)!;
      const resolvedName = name?.trim();
      if (resolvedName && (!profile.name || profile.name === profile.email || profile.name === profile.key)) {
        profile.name = resolvedName;
      }
      if (email && !profile.email) profile.email = email;
      return profile;
    };

    const addInteraction = (profile: CustomerProfile, interaction: CustomerInteraction) => {
      profile.interactions.push(interaction);
      const time = getDateValue(interaction.date);
      if (!profile.firstInteractionAt || time < getDateValue(profile.firstInteractionAt)) {
        profile.firstInteractionAt = interaction.date;
      }
      if (!profile.lastInteractionAt || time > getDateValue(profile.lastInteractionAt)) {
        profile.lastInteractionAt = interaction.date;
      }
    };

    orders?.forEach((order) => {
      const email = normalizeKey(order.purchaser_email);
      const profile = ensureProfile(email, order.purchaser_name, order.purchaser_email);
      profile.kinds.add('customer');
      profile.orders.push(order);
      profile.totalSpend += Number(order.total_amount || 0);
      profile.totalSeats += Number(order.total_seats || 0);
      profile.totalValue += Number(order.total_amount || 0);
      profile.sources.add('events');
      addInteraction(profile, {
        id: `order-${order.id}`,
        type: 'event_order',
        date: order.created_at,
        title: order.event?.title || 'Event order',
        subtitle: order.event?.start_datetime ? formatDateTime(order.event.start_datetime) : undefined,
        detail: `${order.total_seats} seats • ${formatCurrency(order.total_amount)}`,
        amount: order.total_amount,
      });

      order.attendees?.forEach((attendee) => {
        const attendeeKey = attendee.email ? normalizeKey(attendee.email) : `${email}::${normalizeKey(attendee.full_name)}`;
        const attendeeProfile = ensureProfile(attendeeKey, attendee.full_name, attendee.email || '');
        attendeeProfile.kinds.add('attendee');
        attendeeProfile.attendees.push({ order, attendee });
        attendeeProfile.sources.add('events');
        addInteraction(attendeeProfile, {
          id: `attendee-${attendee.id}`,
          type: 'attendee',
          date: order.created_at,
          title: attendee.full_name,
          subtitle: order.event?.title || 'Event attendee',
          detail: order.event?.start_datetime ? formatDateTime(order.event.start_datetime) : undefined,
        });
      });
    });

    productOrders?.forEach((order) => {
      const email = normalizeKey(order.purchaser_email);
      const profile = ensureProfile(email, order.purchaser_name, order.purchaser_email);
      profile.kinds.add('shop_customer');
      profile.productOrders.push(order);
      profile.totalValue += Number(order.total_price || 0);
      profile.sources.add('shop');
      addInteraction(profile, {
        id: `product-order-${order.id}`,
        type: 'product_order',
        date: order.created_at,
        title: order.product?.name || 'Product order',
        subtitle: `${order.quantity} item${order.quantity === 1 ? '' : 's'}`,
        detail: `${formatCurrency(order.total_price)} • ${order.status}`,
        amount: order.total_price,
      });
    });

    giftCards?.forEach((card) => {
      const purchaserKey = normalizeKey(card.purchaser_email);
      const purchaser = ensureProfile(purchaserKey, card.purchaser_name, card.purchaser_email);
      purchaser.kinds.add('gift_card_buyer');
      purchaser.giftCardsPurchased.push(card);
      purchaser.totalValue += Number(card.amount || 0);
      purchaser.sources.add('gift_cards');
      addInteraction(purchaser, {
        id: `gift-card-${card.id}`,
        type: 'gift_card_purchase',
        date: card.created_at,
        title: `Gift card ${card.code}`,
        subtitle: card.recipient_name || 'Gift purchase',
        detail: `${formatCurrency(card.amount)}${card.is_redeemed ? ' • redeemed' : ''}`,
        amount: card.amount,
      });

      if (card.recipient_email) {
        const recipientKey = normalizeKey(card.recipient_email);
        const recipient = ensureProfile(recipientKey, card.recipient_name || card.recipient_email, card.recipient_email);
        recipient.kinds.add('gift_card_recipient');
        recipient.giftCardsReceived.push(card);
        recipient.sources.add('gift_cards');
        addInteraction(recipient, {
          id: `gift-card-recipient-${card.id}`,
          type: 'gift_card_received',
          date: card.created_at,
          title: 'Gift card received',
          subtitle: card.code,
          detail: `${formatCurrency(card.amount)} from ${card.purchaser_name}`,
          amount: card.amount,
        });
      }
    });

    waitlist?.forEach((entry) => {
      const key = normalizeKey(entry.email);
      const profile = ensureProfile(key, entry.name, entry.email);
      profile.kinds.add('waitlist');
      profile.waitlistEntries.push(entry);
      profile.sources.add('waitlist');
      addInteraction(profile, {
        id: `waitlist-${entry.id}`,
        type: 'waitlist',
        date: entry.created_at,
        title: entry.event?.title || 'Waitlist entry',
        subtitle: entry.seats_desired ? `${entry.seats_desired} seat${entry.seats_desired === 1 ? '' : 's'}` : undefined,
        detail: entry.notified ? 'Notified' : 'Pending',
      });
    });

    subscribers?.forEach((subscriber) => {
      const key = normalizeKey(subscriber.email);
      const profile = ensureProfile(key, subscriber.name || subscriber.email, subscriber.email);
      profile.kinds.add('subscriber');
      profile.subscribers.push(subscriber);
      profile.sources.add('newsletter');
      addInteraction(profile, {
        id: `subscriber-${subscriber.id}`,
        type: 'newsletter',
        date: subscriber.created_at,
        title: 'Newsletter subscription',
        subtitle: subscriber.source,
        detail: subscriber.is_active ? 'Active subscriber' : 'Inactive subscriber',
      });
    });

    submissions?.forEach((submission) => {
      const key = normalizeKey(submission.email);
      const profile = ensureProfile(key, submission.name, submission.email);
      profile.kinds.add('lead');
      profile.submissions.push(submission);
      profile.sources.add('submissions');
      addInteraction(profile, {
        id: `submission-${submission.id}`,
        type: 'submission',
        date: submission.created_at,
        title: submission.event_type,
        subtitle: submission.preferred_date || submission.preferred_time || undefined,
        detail: submission.notes || undefined,
      });
    });

    referrals?.forEach((referral) => {
      const key = normalizeKey(referral.referrer_email);
      const profile = ensureProfile(key, referral.referrer_name, referral.referrer_email);
      profile.kinds.add('referrer');
      profile.referrals.push(referral);
      profile.sources.add('referrals');
      addInteraction(profile, {
        id: `referral-${referral.id}`,
        type: 'referral',
        date: referral.created_at,
        title: referral.code,
        subtitle: `${referral.discount_percent}% discount`,
        detail: referral.max_uses ? `${referral.uses}/${referral.max_uses} uses` : `${referral.uses} uses`,
      });
    });

    return Array.from(map.values()).map((profile) => ({
      ...profile,
      interactions: profile.interactions.sort((a, b) => getDateValue(b.date) - getDateValue(a.date)),
    }));
  }, [orders, productOrders, giftCards, waitlist, subscribers, submissions, referrals]);

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allProfiles.filter((profile) => {
      if (!profileMatchesSegment(profile, activeSegment)) return false;

      const matchesQuery = !query || [
        profile.name,
        profile.email,
        ...Array.from(profile.kinds).map((kind) => kind.replace(/_/g, ' ')),
        ...Array.from(profile.sources),
        ...profile.interactions.map((i) => `${i.title} ${i.subtitle || ''} ${i.detail || ''}`),
      ].some((value) => value.toLowerCase().includes(query));

      if (!matchesQuery) return false;

      if (dateFrom || dateTo) {
        const hasAnyInRange = profile.interactions.some((interaction) => withinRange(interaction.date, dateFrom, dateTo));
        if (!hasAnyInRange) return false;
      }

      return true;
    }).sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortField) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        case 'lastInteraction':
          aVal = getDateValue(a.lastInteractionAt);
          bVal = getDateValue(b.lastInteractionAt);
          break;
        case 'orders':
          aVal = a.orders.length;
          bVal = b.orders.length;
          break;
        case 'attendees':
          aVal = a.attendees.length;
          bVal = b.attendees.length;
          break;
        case 'productOrders':
          aVal = a.productOrders.length;
          bVal = b.productOrders.length;
          break;
        case 'giftCards':
          aVal = a.giftCardsPurchased.length + a.giftCardsReceived.length;
          bVal = b.giftCardsPurchased.length + b.giftCardsReceived.length;
          break;
        case 'value':
          aVal = a.totalValue;
          bVal = b.totalValue;
          break;
      }
      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [allProfiles, activeSegment, searchQuery, dateFrom, dateTo, sortField, sortDirection]);

  const totalCustomers = filteredProfiles.length;
  const totalOrders = filteredProfiles.reduce((sum, p) => sum + p.orders.length, 0);
  const totalGiftCards = filteredProfiles.reduce((sum, p) => sum + p.giftCardsPurchased.length, 0);
  const totalValue = filteredProfiles.reduce((sum, p) => sum + p.totalValue, 0);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProfiles = filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const segmentCounts = useMemo(() => {
    return customerSegments.reduce<Record<CustomerSegmentId, number>>((acc, segment) => {
      acc[segment.id] = allProfiles.filter((profile) => profileMatchesSegment(profile, segment.id)).length;
      return acc;
    }, {} as Record<CustomerSegmentId, number>);
  }, [allProfiles]);

  const activeSegmentMeta = customerSegments.find((segment) => segment.id === activeSegment) || customerSegments[0];

  useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [activeSegment, searchQuery, dateFrom, dateTo]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportRows = filteredProfiles.map((profile) => ({
    Name: profile.name,
    Email: profile.email,
    Roles: labelForKinds(profile.kinds).join(', '),
    Orders: profile.orders.length,
    'Event Value': profile.totalSpend,
    'Product Orders': profile.productOrders.length,
    'Gift Cards': profile.giftCardsPurchased.length + profile.giftCardsReceived.length,
    Attendees: profile.attendees.length,
    'First Interaction': profile.firstInteractionAt ? formatDateTime(profile.firstInteractionAt) : '',
    'Last Interaction': profile.lastInteractionAt ? formatDateTime(profile.lastInteractionAt) : '',
  }));

  const handleExport = async (format: ExportFormat) => {
    await exportData(exportRows, 'customers', format, 'All Customers');
    setExportOpen(false);
  };

  const loading = ordersLoading || productOrdersLoading || giftCardsLoading || waitlistLoading || subscribersLoading || submissionsLoading || referralsLoading;
  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>All Customers</h1>
          <p style={{ color: 'var(--text-muted)' }}>Customers, attendees, buyers, and leads in one view</p>
        </div>

        <div className="relative" ref={exportRef}>
          <Button onClick={() => setExportOpen(!exportOpen)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {exportOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-lg shadow-lg border py-1 z-50" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              <button onClick={() => handleExport('csv')} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                <FileText className="h-4 w-4 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">CSV</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Comma-separated values</p>
                </div>
              </button>
              <button onClick={() => handleExport('excel')} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <div className="text-left">
                  <p className="font-medium">Excel</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>.xlsx spreadsheet</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Profiles</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalCustomers}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Orders</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalOrders}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gift Cards</p><p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalGiftCards}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Value</p><p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(totalValue)}</p></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Saved Segments</CardTitle>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{activeSegmentMeta.description}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {customerSegments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => setActiveSegment(segment.id)}
                className="rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                style={{
                  backgroundColor: activeSegment === segment.id ? 'var(--primary-color)' : 'var(--card-bg)',
                  borderColor: activeSegment === segment.id ? 'var(--primary-color)' : 'var(--border-color)',
                  color: activeSegment === segment.id ? 'white' : 'var(--text-secondary)',
                }}
              >
                <span className="font-medium">{segment.label}</span>
                <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: activeSegment === segment.id ? 'rgba(255,255,255,0.2)' : 'var(--admin-input-bg)' }}>
                  {segmentCounts[segment.id] || 0}
                </span>
              </button>
            ))}
          </div>
          {activeSegment !== 'all' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleExport('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Export Segment
              </Button>
              <Button size="sm" variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Draft Campaign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col xl:flex-row gap-4 mb-6 items-start xl:items-center">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search names, emails, roles, events, and notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <label htmlFor="customers-from" className="text-sm" style={{ color: 'var(--text-secondary)' }}>From:</label>
          <input id="customers-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <label htmlFor="customers-to" className="text-sm" style={{ color: 'var(--text-secondary)' }}>To:</label>
          <input id="customers-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          {(searchQuery || dateFrom || dateTo) && (
            <button className="text-sm text-primary-600 hover:text-primary-700" onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Customer Directory</CardTitle>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCustomers} pageSize={pageSize} onPageChange={setPage} position="top" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('name')}>Name <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('email')}>Email <SortIcon field="email" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Roles</th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('orders')}>Orders <SortIcon field="orders" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('attendees')}>Attendees <SortIcon field="attendees" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('productOrders')}>Shop Orders <SortIcon field="productOrders" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('giftCards')}>Gift Cards <SortIcon field="giftCards" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('value')}>Value <SortIcon field="value" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-left py-3 px-4 font-medium text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('lastInteraction')}>Last Interaction <SortIcon field="lastInteraction" sortField={sortField} sortDirection={sortDirection} /></th>
                  <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedProfiles.map((profile) => (
                  <tr key={profile.key} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{profile.name || 'Unnamed'}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{profile.email || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {labelForKinds(profile.kinds).slice(0, 3).map((label) => (
                          <Badge key={label} variant="gray">{label}</Badge>
                        ))}
                        {profile.kinds.size > 3 && <Badge variant="gray">+{profile.kinds.size - 3}</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>{profile.orders.length}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>{profile.attendees.length}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>{profile.productOrders.length}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>{profile.giftCardsPurchased.length + profile.giftCardsReceived.length}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--primary-color)' }}>{formatCurrency(profile.totalValue)}</td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{profile.lastInteractionAt ? formatDateTime(profile.lastInteractionAt) : '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" aria-label="View customer" onClick={() => setSelected(profile)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
</table>
          </div>
          {filteredProfiles.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>No matching customers found.</p>
            </div>
          ) : (
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCustomers} pageSize={pageSize} onPageChange={setPage} position="bottom" />
          )}
        </CardContent>
      </Card>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Customer Summary" className="max-w-4xl">
        {selected && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name || 'Unnamed'}</h3>
                <p style={{ color: 'var(--text-muted)' }}>{selected.email || 'No email'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {labelForKinds(selected.kinds).map((label) => <Badge key={label} variant="gray">{label}</Badge>)}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Last interaction</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.lastInteractionAt ? formatDateTime(selected.lastInteractionAt) : '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--section-bg-light)' }}><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Event Orders</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selected.orders.length}</p></div>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--section-bg-light)' }}><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Attendee Records</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selected.attendees.length}</p></div>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--section-bg-light)' }}><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Shop Orders</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selected.productOrders.length}</p></div>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--section-bg-light)' }}><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Total Value</p><p className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(selected.totalValue)}</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Event Orders</h4>
                <div className="space-y-3 max-h-56 overflow-auto pr-1">
                  {selected.orders.length > 0 ? selected.orders.map((order) => (
                    <div key={order.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{order.event?.title || 'Event'}</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{order.event?.start_datetime ? formatDateTime(order.event.start_datetime) : formatDateTime(order.created_at)}</p>
                        </div>
                        <Badge variant={order.status === 'paid' ? 'success' : order.status === 'refunded' ? 'danger' : 'gray'}>{order.status}</Badge>
                      </div>
                      <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{order.total_seats} seats • {formatCurrency(order.total_amount)}</p>
                    </div>
                  )) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No event orders.</p>}
                </div>
              </div>

              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Shop Orders</h4>
                <div className="space-y-3 max-h-56 overflow-auto pr-1">
                  {selected.productOrders.length > 0 ? selected.productOrders.map((order) => (
                    <div key={order.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{order.product?.name || 'Product'}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatDateTime(order.created_at)}</p>
                      <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{order.quantity} x {formatCurrency(order.unit_price)} • {formatCurrency(order.total_price)}</p>
                    </div>
                  )) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No shop orders.</p>}
                </div>
              </div>

              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Gift Cards</h4>
                <div className="space-y-3 max-h-56 overflow-auto pr-1">
                  {[...selected.giftCardsPurchased.map(card => ({ card, role: 'Purchased' as const })), ...selected.giftCardsReceived.map(card => ({ card, role: 'Received' as const }))].length > 0 ? [...selected.giftCardsPurchased.map(card => ({ card, role: 'Purchased' as const })), ...selected.giftCardsReceived.map(card => ({ card, role: 'Received' as const }))].map(({ card, role }) => (
                    <div key={`${role}-${card.id}`} className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{role} {card.code}</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatDateTime(card.created_at)}</p>
                        </div>
                        <Badge variant={card.is_redeemed ? 'gray' : 'success'}>{card.is_redeemed ? 'Redeemed' : 'Active'}</Badge>
                      </div>
                      <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(card.amount)}{card.recipient_name ? ` • ${card.recipient_name}` : ''}</p>
                    </div>
                  )) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No gift cards.</p>}
                </div>
              </div>

              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Other Interactions</h4>
                <div className="space-y-3 max-h-56 overflow-auto pr-1">
                  {selected.waitlistEntries.length > 0 && (
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Waitlist</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.waitlistEntries.length} entries</p>
                    </div>
                  )}
                  {selected.submissions.length > 0 && (
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Submissions</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.submissions.length} inquiries</p>
                    </div>
                  )}
                  {selected.subscribers.length > 0 && (
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Newsletter</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.subscribers.length} subscriptions</p>
                    </div>
                  )}
                  {selected.referrals.length > 0 && (
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Referrals</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.referrals.length} codes</p>
                    </div>
                  )}
                  {selected.waitlistEntries.length === 0 && selected.submissions.length === 0 && selected.subscribers.length === 0 && selected.referrals.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No additional interactions.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Interaction Timeline</h4>
              <div className="space-y-3 max-h-80 overflow-auto pr-1">
                {selected.interactions.map((interaction) => (
                  <div key={interaction.id} className="flex gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <div className="mt-1">
                      {interaction.type === 'event_order' && <Calendar className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                      {interaction.type === 'attendee' && <Users className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                      {interaction.type === 'product_order' && <ShoppingBag className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                      {interaction.type === 'gift_card_purchase' || interaction.type === 'gift_card_received' ? <Gift className="h-4 w-4" style={{ color: 'var(--primary-color)' }} /> : null}
                      {interaction.type === 'newsletter' && <Mail className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                      {interaction.type === 'waitlist' && <Ticket className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                      {interaction.type === 'submission' && <Star className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                      {interaction.type === 'referral' && <Package className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{interaction.title}</p>
                          {interaction.subtitle && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{interaction.subtitle}</p>}
                        </div>
                        <p className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDateTime(interaction.date)}</p>
                      </div>
                      {interaction.detail && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{interaction.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <CustomerCommunicationHistory
              email={selected.email}
              phone={
                selected.orders.find((o) => o.purchaser_phone)?.purchaser_phone
                ?? selected.productOrders.find((o) => o.purchaser_phone)?.purchaser_phone
                ?? null
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
