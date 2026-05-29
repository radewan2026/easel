import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { usePendingChatCount } from '../../hooks/useChat';
import { useOwnerActionFeed, type OwnerActionItem } from '../../hooks/useOwnerActionFeed';

type Filter = 'all' | 'urgent' | 'chat' | OwnerActionItem['type'];

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'event', label: 'Events' },
  { id: 'private_request', label: 'Private Requests' },
  { id: 'membership', label: 'Memberships' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'chat', label: 'Live Chat' },
];

export default function NotificationsPage() {
  const feed = useOwnerActionFeed();
  const { data: pendingChatCount = 0 } = usePendingChatCount();
  const [filter, setFilter] = useState<Filter>('all');

  const filteredFeed = useMemo(() => {
    if (filter === 'all') return feed;
    if (filter === 'urgent') return feed.filter((item) => item.urgent);
    if (filter === 'chat') return [];
    return feed.filter((item) => item.type === filter);
  }, [feed, filter]);

  const urgentCount = feed.filter((item) => item.urgent).length + (pendingChatCount > 0 ? 1 : 0);
  const chatVisible = (filter === 'all' || filter === 'urgent' || filter === 'chat') && pendingChatCount > 0;
  const hasRows = chatVisible || filteredFeed.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Notification Center</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Owner actions, customer messages, and operational alerts in one queue.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={AlertTriangle} label="Urgent" value={String(urgentCount)} detail="Needs owner attention" tone="danger" />
        <SummaryCard icon={MessageCircle} label="Live Chat" value={String(pendingChatCount)} detail="Customer conversations waiting" tone={pendingChatCount ? 'danger' : 'success'} />
        <SummaryCard icon={Bell} label="Action Feed" value={String(feed.length)} detail="Dashboard signals available" tone="primary" />
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-1">
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: active ? 'var(--primary-color)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {hasRows ? (
            <div className="space-y-3">
              {chatVisible && (
                <Link to="/admin/chat" className="block rounded-lg border p-4 transition-colors hover:opacity-90" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{pendingChatCount} live chat waiting</p>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Review customer conversations in the live chat inbox.</p>
                      </div>
                    </div>
                    <Badge variant="danger">Open chat</Badge>
                  </div>
                </Link>
              )}

              {filteredFeed.map((item) => (
                <Link key={item.id} to={item.to} className="block rounded-lg border p-4 transition-colors hover:opacity-90" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.summary}</p>
                        {item.urgent && <Badge variant="danger">urgent</Badge>}
                        <Badge variant={item.tone}>{item.type.replace('_', ' ')}</Badge>
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                    </div>
                    <span className="inline-flex flex-shrink-0 items-center text-sm font-semibold" style={{ color: 'var(--primary-color)' }}>
                      {item.actionLabel}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-center" style={{ borderColor: 'var(--border-color)' }}>
              <CheckCircle2 className="mx-auto h-9 w-9 text-green-500" />
              <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>All clear</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>No notifications match this filter right now.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: 'primary' | 'success' | 'danger' }) {
  const color = tone === 'danger' ? '#dc2626' : tone === 'success' ? '#16a34a' : 'var(--primary-color)';
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-tertiary)', color }}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      </CardContent>
    </Card>
  );
}
