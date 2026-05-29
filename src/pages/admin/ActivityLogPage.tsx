import { useState } from 'react';
import { useActivityLog, useActivityLogCount } from '../../hooks/useActivityLog';
import { Pagination } from '../../components/ui/Pagination';
import { formatDateTime } from '../../lib/utils';
import { Activity, Search, Filter, Calendar, User, Database, FileText, ShoppingCart, Tag, MapPin, Mail, Settings, Images, HelpCircle, MessageSquare, Gift, Bell, Users, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import type { ActivityLogEntry } from '../../types/database';
import { useOwnerActionFeed } from '../../hooks/useOwnerActionFeed';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';

const exportToCSV = (logs: ActivityLogEntry[]) => {
  const headers = ['Date', 'Action', 'Entity Type', 'Entity', 'Actor', 'Details'];
  const rows = logs.map(log => [
    formatDateTime(log.created_at),
    actionLabels[log.action] || log.action,
    log.entity_type,
    log.entity_name || '',
    log.actor_name || '',
    log.details ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join('; ') : '',
  ]);
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const entityIcons: Record<string, LucideIcon> = {
  event: Calendar,
  venue: MapPin,
  order: ShoppingCart,
  coupon: Tag,
  blog: FileText,
  gallery: Images,
  employee: User,
  assignment: Users,
  private_request: Mail,
  corporate_account: User,
  invoice: FileText,
  email: Mail,
  settings: Settings,
  faq: HelpCircle,
  testimonial: MessageSquare,
  gift_card: Gift,
  waitlist: Bell,
  submission: Mail,
  referral: Tag,
  newsletter: Mail,
};

const entityTypes = ['all', 'event', 'venue', 'order', 'coupon', 'blog', 'gallery', 'employee', 'assignment', 'private_request', 'corporate_account', 'invoice'];

const actionLabels: Record<string, string> = {
  'event.created': 'Created event',
  'event.updated': 'Updated event',
  'event.deleted': 'Deleted event',
  'event.rescheduled': 'Rescheduled event',
  'event.published': 'Published event',
  'event.unpublished': 'Unpublished event',
  'venue.created': 'Created venue',
  'venue.updated': 'Updated venue',
  'venue.deleted': 'Deleted venue',
  'order.refunded': 'Refunded order',
  'order.cancelled': 'Cancelled order',
  'coupon.created': 'Created coupon',
  'coupon.updated': 'Updated coupon',
  'coupon.deleted': 'Deleted coupon',
  'blog.created': 'Created blog post',
  'blog.updated': 'Updated blog post',
  'blog.published': 'Published blog post',
  'blog.deleted': 'Deleted blog post',
  'gallery.created': 'Created gallery',
  'gallery.updated': 'Updated gallery',
  'gallery.deleted': 'Deleted gallery',
  'account.created': 'Created account',
  'account.updated': 'Updated account',
  'account.deleted': 'Deleted account',
  'employee.created': 'Created employee',
  'employee.updated': 'Updated employee',
  'employee.deactivated': 'Deactivated employee',
  'email.sent': 'Sent email',
  'email.bulk_sent': 'Bulk email sent',
  'settings.updated': 'Updated settings',
  'testimonial.created': 'Created testimonial',
  'testimonial.updated': 'Updated testimonial',
  'testimonial.deleted': 'Deleted testimonial',
  'faq.created': 'Created FAQ',
  'faq.updated': 'Updated FAQ',
  'faq.deleted': 'Deleted FAQ',
  'submission.updated': 'Updated submission',
  'gift_card.created': 'Created gift card',
  'gift_card.redeemed': 'Redeemed gift card',
  'waitlist.notified': 'Notified waitlist',
  'referral.created': 'Created referral',
  'newsletter.subscribed': 'Newsletter subscribed',
};

export default function ActivityLogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: totalCount = 0 } = useActivityLogCount();
  const { data: logs, isLoading } = useActivityLog({
    entityType: entityFilter !== 'all' ? entityFilter : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });
  const { data: allLogs } = useActivityLog({
    entityType: entityFilter !== 'all' ? entityFilter : undefined,
    limit: 10000,
    offset: 0,
  });
  const ownerFeed = useOwnerActionFeed();

  const filteredLogs = (logs || []).filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.actor_name?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity_name?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q)
    );
  });

  const exportableLogs = (allLogs || filteredLogs).filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.actor_name?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity_name?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q)
    );
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-secondary)' }}>Activity Log</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Audit trail of all admin actions</p>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <Pagination
              currentPage={page + 1}
              totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p - 1)}
              position="top"
            />
          )}
          {exportableLogs.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportToCSV(exportableLogs)}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
<div className="flex-1 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search by action, actor, or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
<div className="flex items-center gap-2">
           <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
           <select
             value={entityFilter}
             onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
             className="px-3 py-2 border rounded-lg text-sm"
             style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
           >
             {entityTypes.map(t => (
               <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>
             ))}
           </select>
         </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Owner Action Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ownerFeed.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active owner actions right now.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {ownerFeed.slice(0, 6).map((item) => (
                <Link key={item.id} to={item.to} className="rounded-lg border p-3 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.summary}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                    </div>
                    <Badge variant={item.tone}>{item.actionLabel}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <Activity className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--border-color)' }} />
              No activity recorded yet
            </div>
          ) : (
            <div className="space-y-0">
              {filteredLogs.map((log) => {
                const Icon = entityIcons[log.entity_type] || Database;
                const actionLabel = actionLabels[log.action] || log.action;

                return (
<div key={log.id} className="flex items-start gap-4 py-4 border-b last:border-0 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                     <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                       <Icon className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 flex-wrap">
                         <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{actionLabel}</span>
                         {log.entity_name && (
                           <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>&mdash; {log.entity_name}</span>
                         )}
                       </div>
                       <div className="flex items-center gap-3 mt-1">
                         <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                           <User className="h-3 w-3" />
                           {log.actor_name}
                         </span>
                         <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                           {formatDateTime(log.created_at)}
                         </span>
                         <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                           {log.entity_type}
                         </span>
                       </div>
                       {log.details && Object.keys(log.details).length > 0 && (
                         <div className="mt-2 text-xs rounded p-2" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--section-bg-light)' }}>
                           {Object.entries(log.details).map(([key, val]) => (
                             <span key={key} className="mr-3">
                               <span className="font-medium">{key}:</span> {String(val)}
                             </span>
                           ))}
                         </div>
                       )}
                     </div>
                   </div>
                );
              })}
            </div>
          )}

          <Pagination
            currentPage={page + 1}
            totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p - 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
