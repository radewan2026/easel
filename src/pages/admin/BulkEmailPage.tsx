import { useState, useMemo } from 'react';
import { useOrders } from '../../hooks/useEvents';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import { Mail, Send, Users, Search } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { FeatureGate } from '../../components/ui/FeatureGate';

export default function BulkEmailPage() {
  const { data: orders, isLoading } = useOrders();
  const { showToast } = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const uniqueAttendees = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, { name: string; email: string; eventCount: number }>();
    orders.forEach(order => {
      if (order.status !== 'paid' && order.status !== 'refunded') return;
      const key = order.purchaser_email;
      const existing = map.get(key);
      if (existing) {
        existing.eventCount += 1;
      } else {
        map.set(key, { name: order.purchaser_name, email: order.purchaser_email, eventCount: 1 });
      }
      order.attendees?.forEach(a => {
        if (a.email && !map.has(a.email)) {
          map.set(a.email, { name: a.full_name, email: a.email, eventCount: 1 });
        }
      });
    });
    return Array.from(map.values());
  }, [orders]);

  const filteredAttendees = useMemo(() => {
    if (!searchQuery) return uniqueAttendees;
    const q = searchQuery.toLowerCase();
    return uniqueAttendees.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [uniqueAttendees, searchQuery]);

  const toggleEmail = (email: string) => {
    const next = new Set(selectedEmails);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setSelectedEmails(next);
  };

  const selectAll = () => {
    const all = new Set(filteredAttendees.map(a => a.email));
    setSelectedEmails(all);
  };

  const selectNone = () => setSelectedEmails(new Set());

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast('Subject and body are required');
      return;
    }
    if (selectedEmails.size === 0) {
      showToast('Select at least one recipient');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from('email_broadcasts').insert({
        event_id: null,
        subject,
        body,
        recipient_count: selectedEmails.size,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;

      await logActivity({
        action: 'email.bulk_sent',
        entityType: 'email',
        entityName: subject,
        details: { recipientCount: selectedEmails.size },
      });

      showToast(`Email sent to ${selectedEmails.size} attendees`);
      setSent(true);
    } catch (err) {
      showToast('Failed to send: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Send className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Email Sent!</h2>
        <p className="text-gray-500 mb-6">Your email was sent to {selectedEmails.size} attendees.</p>
        <Button onClick={() => { setSent(false); setSubject(''); setBody(''); setSelectedEmails(new Set()); }}>
          Send Another
        </Button>
      </div>
    );
  }

  return (
    <FeatureGate feature="email_marketing" showUpgradeCard upgradeTitle="Bulk Email" upgradeDescription="Upgrade to Growth or Pro to send bulk emails to attendees.">
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Email</h1>
          <p className="text-gray-500">Send email to all past attendees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compose Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={12}
                  placeholder="Write the email body. Basic HTML is supported."
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || !body.trim() || selectedEmails.size === 0}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : `Send to ${selectedEmails.size} attendee${selectedEmails.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recipients ({uniqueAttendees.length})
                </span>
                <span className="text-sm text-primary-600">{selectedEmails.size} selected</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search attendees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-700">Select all</button>
                <span className="text-gray-300">|</span>
                <button onClick={selectNone} className="text-xs text-primary-600 hover:text-primary-700">Select none</button>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {filteredAttendees.map(attendee => (
                  <label
                    key={attendee.email}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(attendee.email)}
                      onChange={() => toggleEmail(attendee.email)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{attendee.name}</p>
                      <p className="text-xs text-gray-500 truncate">{attendee.email}</p>
                    </div>
                  </label>
                ))}
                {filteredAttendees.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    {searchQuery ? 'No matching attendees' : 'No attendees found'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}
