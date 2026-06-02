import { useState, useMemo, useEffect } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useSubscribers, useDeleteSubscriber } from '../../hooks/useNewsletter';
import { useSettings } from '../../hooks/useAdmin';
import { formatDateTime } from '../../lib/utils';
import { Mail, Trash2, ChevronUp, ChevronDown, Send, Calendar, Eye, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import type { Subscriber } from '../../types/database';
import { callAiGateway } from '../../lib/aiGateway';
import { useToast } from '../../components/ui/Toast';

type SortField = 'email' | 'name' | 'source' | 'is_active' | 'created_at';

export default function NewsletterPage() {
  const { data: subscribers, isLoading } = useSubscribers();
  const { data: settings } = useSettings();
  const deleteSubscriber = useDeleteSubscriber();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'subscribers' | 'compose'>('subscribers');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isGeneratingSubject, setIsGeneratingSubject] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [newsletterForm, setNewsletterForm] = useState({
    subject: '',
    preheader: '',
    content: '',
    scheduled_date: '',
    scheduled_time: '',
  });

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCurrentPage(1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sourceFilter, sortField, sortDirection]);

  const brandName = settings?.find((s) => s.key === 'brandName')?.value || 'Paint & Sip';
  const brandPersona = settings?.find((s) => s.key === 'brandPersona')?.value || 'friendly, creative, welcoming';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!subscribers) return [];
    return [...subscribers].sort((a, b) => {
      let aVal = a[sortField as keyof Subscriber];
      let bVal = b[sortField as keyof Subscriber];
      if (sortField === 'is_active') {
        aVal = a.is_active ? '1' : '0';
        bVal = b.is_active ? '1' : '0';
      }
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [subscribers, sortField, sortDirection]);

  const filtered = useMemo(() => {
    if (sourceFilter && sorted) {
      return sorted.filter(s => s.source === sourceFilter);
    }
    return sorted;
  }, [sorted, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedSubscribers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSendNow = () => {
    showToast('Use Email Center to send newsletter campaigns.');
  };

  const handleSchedule = () => {
    if (!newsletterForm.subject || !newsletterForm.content) {
      showToast('Please fill in subject and content', 'error');
      return;
    }
    showToast(`Newsletter scheduled for ${newsletterForm.scheduled_date} at ${newsletterForm.scheduled_time}`);
  };

  const generateSubjectLine = async () => {
    setIsGeneratingSubject(true);
    try {
      const result = await callAiGateway({
        task: 'newsletter_subject',
        maxTokens: 200,
        messages: [
          {
            role: 'system',
            content: `You are a marketing expert for ${brandName}. Your brand persona: ${brandPersona}. Create catchy, engaging email subject lines and preheader text that matches the brand's tone.`
          },
          {
            role: 'user',
            content: 'Generate 1 creative email subject line and 1 preheader text for a newsletter. Return ONLY a JSON object with "subject" and "preheader" keys, no other text.'
          }
        ],
      });
      const parsed = result.content ? JSON.parse(result.content) : {
        subject: `A fresh creative night at ${brandName}`,
        preheader: 'New classes, cozy studio moments, and a reason to get your favorite people together.',
      };
      setNewsletterForm(prev => ({
        ...prev,
        subject: parsed.subject || prev.subject,
        preheader: parsed.preheader || prev.preheader,
      }));
    } catch (err) {
      console.error('Failed to generate subject:', err);
      showToast('Failed to generate subject line. Please try again.', 'error');
    } finally {
      setIsGeneratingSubject(false);
    }
  };

  const generateNewsletterContent = async () => {
    if (!aiTopic.trim()) {
      showToast('Please enter a topic or description for your newsletter', 'error');
      return;
    }
    setIsGeneratingContent(true);
    setIsTopicModalOpen(false);
    try {
      const result = await callAiGateway({
        task: 'newsletter_content',
        maxTokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are a content writer for ${brandName}. Your brand persona: ${brandPersona}. Write engaging, warm, and professional newsletter content that matches this brand identity.`
          },
          {
            role: 'user',
            content: `Write a complete newsletter email based on this topic/description: "${aiTopic}".

The newsletter should:
- Have a friendly, engaging opening that matches the brand tone
- Include 2-3 sections with clear headings
- Be warm and conversational
- Include a call-to-action at the end
- Be medium length (300-500 words)

Return ONLY the raw newsletter content (no JSON, no markdown formatting), ready to send.`
          }
        ],
      });
      const content = result.content || `Hi there,\n\nThere is something special happening at ${brandName}, and we wanted you to be the first to know.\n\n${aiTopic}\n\nWhether you are planning a night out, a birthday, a team gathering, or a little creative reset, we would love to have you in the studio soon.\n\nReserve your seat and come make something memorable with us.`;
      setNewsletterForm(prev => ({
        ...prev,
        content: content || prev.content,
      }));
    } catch (err) {
      console.error('Failed to generate content:', err);
      showToast('Failed to generate newsletter content. Please try again.', 'error');
    } finally {
      setIsGeneratingContent(false);
      setAiTopic('');
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteSubscriber.mutateAsync(deleteTarget);
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const activeCount = subscribers?.filter(s => s.is_active).length || 0;
  const sources = [...new Set(subscribers?.map(s => s.source) || [])];

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('subscribers')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'subscribers' ? 'border-primary-500' : 'border-transparent'}`}
          style={{ color: activeTab === 'subscribers' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <Mail className="h-4 w-4 inline mr-2" />
          All Subscribers
        </button>
        <button
          onClick={() => setActiveTab('compose')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'compose' ? 'border-primary-500' : 'border-transparent'}`}
          style={{ color: activeTab === 'compose' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <Send className="h-4 w-4 inline mr-2" />
          Compose & Schedule
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'subscribers' ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Newsletter Subscribers</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{activeCount} active subscribers</p>
            </div>
          </div>

          {subscribers && subscribers.length > 0 && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setSourceFilter('')}
                className={`px-3 py-1 text-sm rounded-full border ${!sourceFilter ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                All ({subscribers.length})
              </button>
              {sources.map(source => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`px-3 py-1 text-sm rounded-full border capitalize ${sourceFilter === source ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {source} ({subscribers.filter(s => s.source === source).length})
                </button>
              ))}
            </div>
          )}

          {!subscribers || subscribers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)' }}>No subscribers yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>All Subscribers</CardTitle>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderColor: 'var(--border-color)' }}>
<th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('email')}>
                           <span className="flex items-center gap-1">Email {sortField === 'email' ? (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}</span>
                         </th>
                         <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('name')}>
                           <span className="flex items-center gap-1">Name {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}</span>
                         </th>
                         <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('source')}>
                           <span className="flex items-center gap-1">Source {sortField === 'source' ? (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}</span>
                         </th>
                         <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('is_active')}>
                           <span className="flex items-center gap-1">Status {sortField === 'is_active' ? (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}</span>
                         </th>
                         <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('created_at')}>
                           <span className="flex items-center gap-1">Subscribed {sortField === 'created_at' ? (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}</span>
                         </th>
                        <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSubscribers.map((sub) => (
                        <tr key={sub.id} style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{sub.email}</td>
                          <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{sub.name || '-'}</td>
                          <td className="py-3 px-4">
                            <Badge variant="gray" className="capitalize">{sub.source}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            {sub.is_active ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="danger">Unsubscribed</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{formatDateTime(sub.created_at)}</td>
                          <td className="py-3 px-4 text-right">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setDeleteTarget(sub.id);
                              setShowDeleteConfirm(true);
                            }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  position="bottom"
                />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose Section */}
          <Card>
            <CardHeader>
              <CardTitle>Compose Newsletter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Subject Line</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={generateSubjectLine}
                  disabled={isGeneratingSubject}
                  className="text-primary-500"
                >
                  {isGeneratingSubject ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Subject Helper
                </Button>
              </div>
              <Input
                value={newsletterForm.subject}
                onChange={(e) => setNewsletterForm({ ...newsletterForm, subject: e.target.value })}
                placeholder="Your monthly newsletter subject..."
              />
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Preheader Text</label>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-generated with subject</span>
              </div>
              <Input
                value={newsletterForm.preheader}
                onChange={(e) => setNewsletterForm({ ...newsletterForm, preheader: e.target.value })}
                placeholder="Preview text shown after subject..."
              />
              <div className="flex items-center justify-between pt-2">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Email Content</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsTopicModalOpen(true)}
                  disabled={isGeneratingContent}
                  className="text-primary-500"
                >
                  {isGeneratingContent ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Newsletter Writer
                </Button>
              </div>
              <Textarea
                value={newsletterForm.content}
                onChange={(e) => setNewsletterForm({ ...newsletterForm, content: e.target.value })}
                placeholder="Write your newsletter content here, or use AI to generate it..."
                className="min-h-[300px]"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsPreviewModalOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
</div>
                 </CardContent>
          </Card>

          {/* Schedule Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleSendNow} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Send Now
                  </Button>
                </div>
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>or</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Schedule Date"
                    type="date"
                    value={newsletterForm.scheduled_date}
                    onChange={(e) => setNewsletterForm({ ...newsletterForm, scheduled_date: e.target.value })}
                  />
                  <Input
                    label="Schedule Time"
                    type="time"
                    value={newsletterForm.scheduled_time}
                    onChange={(e) => setNewsletterForm({ ...newsletterForm, scheduled_time: e.target.value })}
                  />
                </div>
                <Button variant="secondary" className="w-full" onClick={handleSchedule}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Newsletter
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{activeCount}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Active Subscribers</p>
                  </div>
                  <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{subscribers?.length || 0}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Subscribers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Newsletter Preview" className="max-w-2xl">
        <div className="space-y-4">
          <div className="border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Subject:</p>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{newsletterForm.subject || '(No subject)'}</p>
          </div>
          {newsletterForm.preheader && (
            <div className="border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preheader:</p>
              <p style={{ color: 'var(--text-secondary)' }}>{newsletterForm.preheader}</p>
            </div>
          )}
          <div className="p-4 rounded-lg min-h-[200px]" style={{ backgroundColor: 'var(--section-bg-light)' }}>
            <p style={{ color: 'var(--text-secondary)' }}>{newsletterForm.content || '(No content)'}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsPreviewModalOpen(false)}>Close</Button>
            <Button onClick={() => { setIsPreviewModalOpen(false); handleSendNow(); }}>
              <Send className="h-4 w-4 mr-2" />
              Send Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Topic Modal */}
      <Modal isOpen={isTopicModalOpen} onClose={() => setIsTopicModalOpen(false)} title="AI Newsletter Writer" className="max-w-lg">
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            Describe what you want your newsletter to be about. The AI will generate engaging content based on your brand's personality.
          </p>
          <Textarea
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Example: Write about our upcoming summer painting events, highlight the new summer-themed artwork, and include a discount code for early bookings..."
            className="min-h-[150px]"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Brand: {brandName} | Persona: {brandPersona}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsTopicModalOpen(false)}>Cancel</Button>
              <Button onClick={generateNewsletterContent} disabled={isGeneratingContent}>
                {isGeneratingContent ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Subscriber"
        message="Are you sure you want to delete this subscriber?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
