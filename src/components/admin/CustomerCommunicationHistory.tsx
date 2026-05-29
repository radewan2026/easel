import { Mail, MessageSquare } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatDateTime } from '../../lib/utils';
import { useCustomerCommunications } from '../../hooks/useCustomerCommunications';

interface Props {
  email?: string | null;
  phone?: string | null;
}

const statusVariant: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'gray'> = {
  sent: 'primary',
  delivered: 'success',
  opened: 'success',
  clicked: 'success',
  queued: 'gray',
  failed: 'danger',
  bounced: 'danger',
  complained: 'danger',
  suppressed: 'warning',
  opted_out: 'warning',
};

export function CustomerCommunicationHistory({ email, phone }: Props) {
  const { data, isLoading } = useCustomerCommunications(email, phone);

  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Communication History</h4>
        {data && (
          <div className="flex gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {data.emailCount}</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {data.smsCount}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : !data?.backendConnected ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Communication tables not connected. Deploy the email/SMS migrations to enable history.
        </p>
      ) : data.entries.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No emails or texts sent to this customer yet.
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {data.entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
              <div className="mt-0.5">
                {entry.channel === 'email'
                  ? <Mail className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />
                  : <MessageSquare className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                    {entry.subject || (entry.channel === 'sms' ? 'SMS message' : 'Email')}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge variant={statusVariant[entry.status] || 'gray'}>{entry.status}</Badge>
                    <p className="whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDateTime(entry.sentAt || entry.createdAt)}
                    </p>
                  </div>
                </div>
                {entry.preview && <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.preview}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
