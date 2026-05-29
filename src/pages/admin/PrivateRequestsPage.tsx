import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivateEventRequests, useUpdateRequestStatus } from '../../hooks/usePrivateEventRequests';
import { formatDateTime } from '../../lib/utils';
import { Mail, Calendar, Users, Eye, ArrowRight, XCircle, Columns3, Table2, Clock, ExternalLink, MessageSquare } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { ReasonConfirmDialog } from '../../components/ui/ReasonConfirmDialog';
import type { PrivateEventRequest, PrivateRequestStatus } from '../../types/database';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { useEmployees } from '../../hooks/useEmployees';
import { usePrivateRequestMetadata, useUpdatePrivateRequestMetadata, type PrivateRequestMetadata } from '../../hooks/usePrivateRequestMetadata';
import { formatCurrency } from '../../lib/utils';

const statusColors: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'gray'> = {
  submitted: 'primary',
  contacted: 'warning',
  confirmed: 'success',
  converted_to_event: 'gray',
  declined: 'danger',
};

const eventTypeColors: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'gray'> = {
  bachelorette: 'danger',
  corporate: 'primary',
  birthday: 'warning',
  holiday: 'success',
  other: 'gray',
};

const statusLabels: Record<PrivateRequestStatus, string> = {
  submitted: 'Submitted',
  contacted: 'Contacted',
  confirmed: 'Confirmed',
  converted_to_event: 'Converted',
  declined: 'Declined',
};

const eventTypeLabels: Record<string, string> = {
  bachelorette: 'Bachelorette',
  corporate: 'Corporate',
  birthday: 'Birthday',
  holiday: 'Holiday',
  other: 'Other',
};

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'converted_to_event', label: 'Converted' },
  { value: 'declined', label: 'Declined' },
];

const pipelineStatuses: PrivateRequestStatus[] = ['submitted', 'contacted', 'confirmed', 'converted_to_event', 'declined'];

const statusChangeOptions: { value: PrivateRequestStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'converted_to_event', label: 'Converted to Event' },
  { value: 'declined', label: 'Declined' },
];

export default function PrivateRequestsPage() {
  const navigate = useNavigate();
  const { data: requests, isLoading } = usePrivateEventRequests();
  const { data: employees = [] } = useEmployees({ status: 'active' });
  const { data: requestMetadata = {} } = usePrivateRequestMetadata();
  const updateStatus = useUpdateRequestStatus();
  const updateMetadata = useUpdatePrivateRequestMetadata();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<PrivateEventRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [statusSelect, setStatusSelect] = useState<PrivateRequestStatus>('submitted');
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [metadataForm, setMetadataForm] = useState<PrivateRequestMetadata>({});
  const [requestTab, setRequestTab] = useState<'request' | 'conversation' | 'proposal' | 'operations'>('request');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    if (selected) {
      queueMicrotask(() => {
        setAdminNotes(selected.admin_notes || '');
        setStatusSelect(selected.status);
        setMetadataForm(requestMetadata[selected.id] || {});
        setRequestTab('request');
      });
    }
  }, [selected, requestMetadata]);

  const filtered = useMemo(() => {
    const result = requests?.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    }) || [];
    return result;
  }, [requests, statusFilter]);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRequests = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pipelineGroups = useMemo(() => {
    return pipelineStatuses.map((status) => ({
      status,
      items: (requests || []).filter((request) => request.status === status),
    }));
  }, [requests]);

  const counts = {
    submitted: requests?.filter((r) => r.status === 'submitted').length || 0,
    contacted: requests?.filter((r) => r.status === 'contacted').length || 0,
    confirmed: requests?.filter((r) => r.status === 'confirmed').length || 0,
    converted_to_event: requests?.filter((r) => r.status === 'converted_to_event').length || 0,
    declined: requests?.filter((r) => r.status === 'declined').length || 0,
  };

  const nowTime = new Date().getTime();
  const metadataCounts = {
    followUpDue: (requests || []).filter((request) => {
      const date = requestMetadata[request.id]?.nextFollowUpDate;
      return date && new Date(date + 'T23:59:59').getTime() < nowTime && !['converted_to_event', 'declined'].includes(request.status);
    }).length,
    estimatedPipeline: (requests || []).reduce((sum, request) => sum + Number(requestMetadata[request.id]?.estimatedValue || 0), 0),
    proposalsSent: (requests || []).filter((request) => ['sent', 'accepted'].includes(requestMetadata[request.id]?.proposalStatus || '')).length,
    depositsRequested: (requests || []).filter((request) => ['requested', 'paid'].includes(requestMetadata[request.id]?.depositStatus || '')).length,
  };

  const handleStatusChange = async () => {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({ id: selected.id, status: statusSelect, adminNotes });
      showToast('Status updated to ' + statusSelect, 'success');
      setSelected({ ...selected, status: statusSelect, admin_notes: adminNotes });
    } catch (err) {
      showToast('Failed to update status: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const appendNoteTemplate = (text: string) => {
    const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setAdminNotes((prev) => [prev.trim(), `[${stamp}] ${text}`].filter(Boolean).join('\n'));
  };

  const handleMarkContacted = async () => {
    if (!selected) return;
    try {
      const nextNotes = adminNotes.trim() || `Contacted ${selected.contact_name} about their ${eventTypeLabels[selected.event_type] || selected.event_type} event.`;
      await updateStatus.mutateAsync({ id: selected.id, status: 'contacted', adminNotes: nextNotes });
      showToast('Marked as contacted', 'success');
      setStatusSelect('contacted');
      setAdminNotes(nextNotes);
      setSelected({ ...selected, status: 'contacted', admin_notes: nextNotes });
    } catch (err) {
      showToast('Failed to mark as contacted: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const draftReplyUrl = (request: PrivateEventRequest) => {
    const subject = encodeURIComponent(`Private event request for ${request.preferred_date}`);
    const body = encodeURIComponent(`Hi ${request.contact_name},\n\nThanks for reaching out about a private paint-and-sip event for ${request.guest_count} guests. We'd love to help.\n\nA few quick questions so we can put together the right option:\n- Is ${request.preferred_date} still your preferred date?\n- Do you have a target budget or package in mind?\n- Would you like us to recommend a painting, or do you have one in mind?\n\nOnce I have that, I can send over next steps.\n\nThank you!`);
    return `mailto:${request.contact_email}?subject=${subject}&body=${body}`;
  };

  const draftProposalUrl = (request: PrivateEventRequest) => {
    const metadata = requestMetadata[request.id] || {};
    const subject = encodeURIComponent(`Private event proposal for ${request.preferred_date}`);
    const body = encodeURIComponent(`Hi ${request.contact_name},\n\nThanks again for your private event request. Based on ${request.guest_count} guests on ${request.preferred_date}, here is the proposed package:\n\nPackage:\nEstimated total: ${metadata.estimatedValue ? formatCurrency(metadata.estimatedValue) : '[add estimate]'}\nDeposit due: ${metadata.depositAmount ? formatCurrency(metadata.depositAmount) : '[add deposit]'}\nIncludes:\n- Guided painting experience\n- Supplies and setup\n- Host/instructor support\n\nTo hold the date, we can collect the deposit and then finalize the guest count and painting details.\n\nWould you like us to move forward with this option?\n\nThank you!`);
    return `mailto:${request.contact_email}?subject=${subject}&body=${body}`;
  };

  const draftDepositUrl = (request: PrivateEventRequest) => {
    const metadata = requestMetadata[request.id] || {};
    const subject = encodeURIComponent(`Deposit request for your private event`);
    const body = encodeURIComponent(`Hi ${request.contact_name},\n\nGreat news — we can move forward with your private event request for ${request.preferred_date}.\n\nDeposit due: ${metadata.depositAmount ? formatCurrency(metadata.depositAmount) : '[add deposit amount]'}\nEstimated event total: ${metadata.estimatedValue ? formatCurrency(metadata.estimatedValue) : '[add estimate]'}\n\nOnce the deposit is paid, we will confirm the date and finalize the remaining details.\n\nThank you!`);
    return `mailto:${request.contact_email}?subject=${subject}&body=${body}`;
  };

  const handleDecline = async (reason: string) => {
    if (!selected) return;
    try {
      const nextNotes = [adminNotes.trim(), reason ? `Decline reason: ${reason}` : 'Declined without reason'].filter(Boolean).join('\n');
      await updateStatus.mutateAsync({ id: selected.id, status: 'declined', adminNotes: nextNotes });
      showToast('Request declined', 'success');
      setShowDeclineConfirm(false);
      setSelected(null);
    } catch (err) {
      showToast('Failed to decline request: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleConvertToEvent = () => {
    if (!selected) return;
    navigate('/admin/events/new', { state: { privateRequest: selected } });
  };

  const handleSaveMetadata = async () => {
    if (!selected) return;
    try {
      const owner = employees.find((employee) => employee.id === metadataForm.assignedOwnerId);
      await updateMetadata.mutateAsync({
        requestId: selected.id,
        metadata: {
          ...metadataForm,
          assignedOwnerName: owner?.name || metadataForm.assignedOwnerName,
          estimatedValue: metadataForm.estimatedValue ? Number(metadataForm.estimatedValue) : undefined,
        },
      });
      showToast('Metadata saved', 'success');
    } catch (err) {
      showToast('Failed to save metadata: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const paintingLabel = (r: PrivateEventRequest) => {
    if (r.painting_selection_type === 'owner_chooses') return 'Owner Chooses';
    if (r.painting_selection_type === 'custom_request') return r.custom_painting_request || 'Custom Request';
    return r.painting?.caption || 'Selected Painting';
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Private Event Pipeline</h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Track high-value leads from public request to confirmed event.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <button
              onClick={() => setViewMode('pipeline')}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
              style={{ backgroundColor: viewMode === 'pipeline' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'pipeline' ? 'white' : 'var(--text-primary)' }}
            >
              <Columns3 className="h-4 w-4" /> Pipeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
              style={{ backgroundColor: viewMode === 'table' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'table' ? 'white' : 'var(--text-primary)' }}
            >
              <Table2 className="h-4 w-4" /> Table
            </button>
          </div>
          {viewMode === 'table' && (
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {(['submitted', 'contacted', 'confirmed', 'converted_to_event', 'declined'] as const).map((status) => (
          <Card
            key={status}
            className="cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all"
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
          >
            <CardContent className="pt-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{statusLabels[status]}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Estimated Pipeline</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(metadataCounts.estimatedPipeline)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Follow-Ups Due</p>
            <p className="text-2xl font-bold" style={{ color: metadataCounts.followUpDue ? '#d97706' : 'var(--text-primary)' }}>{metadataCounts.followUpDue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Active Leads</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{(requests || []).filter((r) => !['converted_to_event', 'declined'].includes(r.status)).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Proposals Sent</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{metadataCounts.proposalsSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Deposits In Play</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{metadataCounts.depositsRequested}</p>
          </CardContent>
        </Card>
      </div>

      {requests?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No private requests yet.</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Requests appear here when guests submit the public private-events form. You can test it from the public site, then convert a good lead into an event or invoice.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'pipeline' ? (
        <div className="grid gap-4 xl:grid-cols-5">
          {pipelineGroups.map(({ status, items }) => (
            <Card key={status} className="min-h-96">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{statusLabels[status]}</span>
                  <Badge variant={statusColors[status]}>{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.length ? items.map((request) => (
                    <button
                      key={request.id}
                      onClick={() => setSelected(request)}
                      className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
                      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{request.contact_name}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{request.company_name || request.contact_email}</p>
                        </div>
                        <Badge variant={eventTypeColors[request.event_type] || 'gray'}>{eventTypeLabels[request.event_type] || request.event_type}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {request.guest_count}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {request.preferred_date}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <Clock className="h-3 w-3" /> {formatDateTime(request.created_at)}
                        </span>
                        {requestMetadata[request.id]?.estimatedValue && (
                          <span className="text-xs font-semibold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(requestMetadata[request.id].estimatedValue || 0)}</span>
                        )}
                        <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </button>
                  )) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                      No leads here
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Requests</CardTitle>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Name</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Type</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Date Requested</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Event Date</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Guests</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Painting</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      style={{ borderColor: 'var(--border-color)' }}
                      onClick={() => setSelected(r)}
                    >
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{r.contact_name}</td>
                      <td className="py-3 px-4">
                        <Badge variant={eventTypeColors[r.event_type] || 'gray'}>{eventTypeLabels[r.event_type] || r.event_type}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{formatDateTime(r.created_at)}</td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.preferred_date}</td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.guest_count}</span>
                      </td>
                      <td className="py-3 px-4 text-sm truncate max-w-[150px]" style={{ color: 'var(--text-secondary)' }}>{paintingLabel(r)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={statusColors[r.status]}>{statusLabels[r.status]}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Request Details"
        className="max-w-4xl"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{selected.contact_name}</h3>
                {selected.company_name && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.company_name}</p>
                )}
              </div>
              <Badge variant={statusColors[selected.status]} className="text-sm px-3 py-1">
                {statusLabels[selected.status]}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              {[
                { id: 'request', label: 'Request' },
                { id: 'conversation', label: 'Conversation' },
                { id: 'proposal', label: 'Proposal' },
                { id: 'operations', label: 'Operations' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRequestTab(tab.id as typeof requestTab)}
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: requestTab === tab.id ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                    color: requestTab === tab.id ? 'white' : 'var(--text-primary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {requestTab === 'request' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Mail className="h-3.5 w-3.5" /> Email
                    </p>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selected.contact_email}</p>
                  </div>
                  {selected.contact_phone && (
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Phone</p>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selected.contact_phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Calendar className="h-3.5 w-3.5" /> Event Date
                    </p>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selected.preferred_date} — {selected.preferred_time}</p>
                  </div>
                  {selected.alternate_date && (
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Alternate Date</p>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selected.alternate_date}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Users className="h-3.5 w-3.5" /> Guest Count
                    </p>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selected.guest_count}</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Event Type</p>
                    <Badge variant={eventTypeColors[selected.event_type] || 'gray'}>{eventTypeLabels[selected.event_type] || selected.event_type}</Badge>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Venue</p>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selected.venue?.name || 'No preference'}</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Painting</p>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{paintingLabel(selected)}</p>
                  </div>
                </div>

                {selected.special_requests && (
                  <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Request Notes</p>
                    <pre className="whitespace-pre-wrap rounded-lg p-3 text-sm font-sans" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}>{selected.special_requests}</pre>
                  </div>
                )}

                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Submitted</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(selected.created_at)}</p>
                </div>
              </div>
            )}

            {requestTab === 'conversation' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handleMarkContacted} disabled={updateStatus.isPending || selected.status === 'contacted'}>
                      <MessageSquare className="h-4 w-4 mr-1" /> Mark Contacted
                    </Button>
                    <a href={draftReplyUrl(selected)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4 mr-1" /> Ask Questions
                      </Button>
                    </a>
                    <a href={draftProposalUrl(selected)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4 mr-1" /> Draft Proposal
                      </Button>
                    </a>
                    <a href={draftDepositUrl(selected)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4 mr-1" /> Request Deposit
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button size="sm" variant="ghost" onClick={() => appendNoteTemplate('Follow up tomorrow with package/pricing options.')}>
                    Add follow-up note
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => appendNoteTemplate('Need more info: budget, flexibility, location, and deposit readiness.')}>
                    Add needs-info note
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => appendNoteTemplate('Proposal sent. Waiting for confirmation and deposit.')}>
                    Add proposal note
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => appendNoteTemplate('Deposit requested. Hold date pending payment.')}>
                    Add deposit note
                  </Button>
                </div>

                <Textarea
                  label="Admin Notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={8}
                  placeholder="Add internal notes..."
                />
              </div>
            )}

            {requestTab === 'proposal' && (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Proposal & Deposit</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Track the bridge from qualified lead to paid private event.</p>
                  </div>
                  <Button size="sm" onClick={handleSaveMetadata} disabled={updateMetadata.isPending}>
                    {updateMetadata.isPending ? 'Saving...' : 'Save Proposal'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Estimated Value"
                    type="number"
                    value={metadataForm.estimatedValue ?? ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, estimatedValue: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="750"
                  />
                  <Input
                    label="Deposit Amount"
                    type="number"
                    value={metadataForm.depositAmount ?? ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, depositAmount: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="150"
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Proposal Status</label>
                    <select
                      value={metadataForm.proposalStatus || 'not_started'}
                      onChange={(e) => setMetadataForm((prev) => ({ ...prev, proposalStatus: e.target.value as PrivateRequestMetadata['proposalStatus'] }))}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="drafted">Drafted</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Deposit Status</label>
                    <select
                      value={metadataForm.depositStatus || 'not_requested'}
                      onChange={(e) => setMetadataForm((prev) => ({ ...prev, depositStatus: e.target.value as PrivateRequestMetadata['depositStatus'] }))}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="not_requested">Not Requested</option>
                      <option value="requested">Requested</option>
                      <option value="paid">Paid</option>
                      <option value="waived">Waived</option>
                    </select>
                  </div>
                  <Input
                    label="Proposal Sent"
                    type="date"
                    value={metadataForm.proposalSentDate || ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, proposalSentDate: e.target.value || undefined }))}
                  />
                  <Input
                    label="Proposal Expires"
                    type="date"
                    value={metadataForm.proposalExpiresDate || ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, proposalExpiresDate: e.target.value || undefined }))}
                  />
                </div>
              </div>
            )}

            {requestTab === 'operations' && (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Qualification & Operations</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Use this to decide whether the lead is worth pursuing and who owns it.</p>
                  </div>
                  <Button size="sm" onClick={handleSaveMetadata} disabled={updateMetadata.isPending}>
                    {updateMetadata.isPending ? 'Saving...' : 'Save Ops'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Qualification</label>
                    <select
                      value={metadataForm.qualification || 'new'}
                      onChange={(e) => setMetadataForm((prev) => ({ ...prev, qualification: e.target.value as PrivateRequestMetadata['qualification'] }))}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="new">New</option>
                      <option value="needs_info">Needs More Info</option>
                      <option value="qualified">Qualified</option>
                      <option value="not_fit">Not a Fit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Assigned Owner</label>
                    <select
                      value={metadataForm.assignedOwnerId || ''}
                      onChange={(e) => {
                        const owner = employees.find((employee) => employee.id === e.target.value);
                        setMetadataForm((prev) => ({ ...prev, assignedOwnerId: e.target.value || undefined, assignedOwnerName: owner?.name }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  </div>
                  <Input
                    label="Next Follow-Up"
                    type="date"
                    value={metadataForm.nextFollowUpDate || ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, nextFollowUpDate: e.target.value || undefined }))}
                  />
                  <Input
                    label="Close Probability %"
                    type="number"
                    value={metadataForm.probability ?? ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, probability: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="60"
                  />
                  <Input
                    label="Package Interest"
                    value={metadataForm.packageInterest || ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, packageInterest: e.target.value || undefined }))}
                    placeholder="Premium private, mobile event, corporate team-building..."
                  />
                  <Input
                    label="Source"
                    value={metadataForm.source || ''}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, source: e.target.value || undefined }))}
                    placeholder="Website, referral, corporate partner..."
                  />
                </div>

                <div className="mt-4 rounded-lg bg-white/60 p-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Conversion checklist</p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>□ Date availability confirmed</span>
                    <span>□ Package/pricing approved</span>
                    <span>□ Deposit collected or waived</span>
                    <span>□ Painting selected</span>
                    <span>□ Staff owner assigned</span>
                    <span>□ Convert to event when ready</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Status</label>
                <div className="flex items-center gap-2">
                  <Select
                    options={statusChangeOptions}
                    value={statusSelect}
                    onChange={(e) => setStatusSelect(e.target.value as PrivateRequestStatus)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleStatusChange} disabled={updateStatus.isPending}>Save</Button>
                </div>
              </div>
            </div>

            {selected.status !== 'converted_to_event' && selected.status !== 'declined' && (
              <div className="border-t pt-4 flex justify-end gap-2" style={{ borderColor: 'var(--border-color)' }}>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeclineConfirm(true)}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Decline
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConvertToEvent}
                  disabled={(selected.status as string) === 'converted_to_event'}
                >
                  <ArrowRight className="h-4 w-4 mr-1" /> Convert to Event
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ReasonConfirmDialog
        isOpen={showDeclineConfirm}
        onClose={() => setShowDeclineConfirm(false)}
        onConfirm={handleDecline}
        title="Decline Private Request"
        message="This will move the request out of the active pipeline. Capture why so the team can understand the outcome later."
        reasonLabel="Decline reason"
        reasonPlaceholder="Example: date unavailable, guest count too small, customer chose another venue..."
        confirmLabel="Decline Request"
        variant="danger"
        icon="warning"
        isLoading={updateStatus.isPending}
        requireReason
      />
    </div>
  );
}
