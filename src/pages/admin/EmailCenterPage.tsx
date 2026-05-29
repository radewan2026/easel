import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  Columns3,
  Copy,
  Edit3,
  FileCheck2,
  Gift,
  Globe2,
  Heading1,
  Image,
  KeyRound,
  Link2,
  ListMinus,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Minus,
  MousePointerClick,
  Palette,
  PauseCircle,
  Percent,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Trash2,
  Type,
  UserMinus,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FeatureGate } from '../../components/ui/FeatureGate';
import { Pagination } from '../../components/ui/Pagination';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { useSettings, useUpdateSetting } from '../../hooks/useAdmin';
import { useEmailCenter, useQueueEmailCampaign, useUpdateEmailCampaignStatus, type EmailSegment, type EmailTemplate, type EmailTemplateType } from '../../hooks/useEmailCenter';
import { useSmsCenter, useSaveSmsTemplate, useDeleteSmsTemplate, useSendSms } from '../../hooks/useSmsCenter';
import { useGalleries } from '../../hooks/useGallery';
import { readLocalAnalyticsEvents } from '../../lib/analytics';
import { addTrackingToHtmlLinks, buildTrackedUrl, extractHtmlLinks, type TrackingParams } from '../../lib/marketingLinks';
import { supabase } from '../../lib/supabase';
import { callAiGateway } from '../../lib/aiGateway';
import { formatCurrency, formatDateTime, slugify } from '../../lib/utils';
import type { Setting } from '../../types/database';
import {
  Tab, tabs, intentVariant, getErrorMessage, workflowSteps,
  type SuppressionReason, type SuppressionEntry, type SegmentRule,
  type RecoveryCampaignDraft, RECOVERY_DRAFT_STORAGE_KEY,
  type EmailBlockType, type EmailBlock, type EmailBrandStyles,
  type EmailTemplateVersion, type EmailWorkspaceSettings,
  defaultBrandStyles, mergeTagGroups, readJson,
  bodyToBlocks, blocksToHtml,
  smsStatusVariant, smsSegmentCount, type SmsTemplate, type SmsTemplateType,
} from '../../components/admin/email/emailUtils';

export default function EmailCenterPage() {
  const { data, isLoading, isError, error } = useEmailCenter();
  const { data: galleries = [] } = useGalleries();
  const { data: settingsRows } = useSettings();
  const updateSetting = useUpdateSetting();
  const queueCampaign = useQueueEmailCampaign();
  const updateCampaignStatus = useUpdateEmailCampaignStatus();
  const { data: smsData } = useSmsCenter();
  const saveSmsTemplate = useSaveSmsTemplate();
  const deleteSmsTemplate = useDeleteSmsTemplate();
  const sendSms = useSendSms();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  // SMS tab state
  const [smsTemplateDraft, setSmsTemplateDraft] = useState<SmsTemplate | null>(null);
  const [smsTestRecipients, setSmsTestRecipients] = useState('');
  const [smsSendBody, setSmsSendBody] = useState('');
  const [smsAudience, setSmsAudience] = useState('opt-in-marketing');
  const [smsSending, setSmsSending] = useState(false);
  const [deleteConfirmSmsTemplate, setDeleteConfirmSmsTemplate] = useState<SmsTemplate | null>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState('newsletter-active');
  const [campaignName, setCampaignName] = useState('Weekend seats promo');
  const [subject, setSubject] = useState('Fresh paint nights are open this week');
  const [body, setBody] = useState('Hi {{first_name}}, here are a few upcoming events we think you will love.');
  const [trackingSource, setTrackingSource] = useState(() => localStorage.getItem('easel_email_utm_source') || 'email');
  const [trackingMedium, setTrackingMedium] = useState(() => localStorage.getItem('easel_email_utm_medium') || 'campaign');
  const [trackingCampaign, setTrackingCampaign] = useState(() => localStorage.getItem('easel_email_utm_campaign') || 'weekend-seats-promo');
  const [trackingContent, setTrackingContent] = useState(() => localStorage.getItem('easel_email_utm_content') || 'primary-cta');
  const [selectedTemplateId, setSelectedTemplateId] = useState('gift-card-reminder');
  const [campaignSendMode, setCampaignSendMode] = useState<'queue' | 'schedule'>('queue');
  const [scheduledAt, setScheduledAt] = useState('');
  const [approvalNote, setApprovalNote] = useState('Owner review required before send.');
  const [abTestEnabled, setAbTestEnabled] = useState(() => localStorage.getItem('easel_email_ab_test_enabled') === 'true');
  const [subjectVariantB, setSubjectVariantB] = useState(() => localStorage.getItem('easel_email_subject_variant_b') || 'Last call: fresh paint nights this week');
  const [abSplitPercent, setAbSplitPercent] = useState(() => Number(localStorage.getItem('easel_email_ab_split_percent')) || 20);
  const [winningMetric, setWinningMetric] = useState(() => localStorage.getItem('easel_email_winning_metric') || 'click_rate');
  const [holdoutPercent, setHoldoutPercent] = useState(() => Number(localStorage.getItem('easel_email_holdout_percent')) || 0);
  const [editableTemplates, setEditableTemplates] = useState<EmailTemplate[]>(() => readJson<EmailTemplate[]>('easel_email_templates', []));
  const [templateDraft, setTemplateDraft] = useState<EmailTemplate | null>(null);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirmSegment, setDeleteConfirmSegment] = useState<string | null>(null);
  const [cancelConfirmCampaign, setCancelConfirmCampaign] = useState<string | null>(null);
  const [visualBlocks, setVisualBlocks] = useState<EmailBlock[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [suppressing, setSuppressing] = useState(false);
  const [filterTemplates, setFilterTemplates] = useState('');
  const [filterCampaigns, setFilterCampaigns] = useState('');
  const [filterAutomations, setFilterAutomations] = useState('');
  const [filterSuppressions, setFilterSuppressions] = useState('');
  const [filterSegments, setFilterSegments] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);
  const [suppressionPage, setSuppressionPage] = useState(1);
  const PAGE_SIZE = 20;
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [draggedBlockId, setDraggedBlockId] = useState('');
  const [brandStyles, setBrandStyles] = useState<EmailBrandStyles>(() => readJson<EmailBrandStyles>('easel_email_brand_styles', defaultBrandStyles));
  const [templateVersions, setTemplateVersions] = useState<EmailTemplateVersion[]>(() => readJson<EmailTemplateVersion[]>('easel_email_template_versions', []));
  const [versionNote, setVersionNote] = useState('Owner edit');
  const [testEmail, setTestEmail] = useState(() => localStorage.getItem('easel_email_test_recipient') || '');
  const [sendingTest, setSendingTest] = useState(false);
  const [customSegments, setCustomSegments] = useState<SegmentRule[]>(() => readJson<SegmentRule[]>('easel_email_segments', []));
  const [segmentDraft, setSegmentDraft] = useState({
    name: 'VIP repeat customers',
    description: 'Customers who should receive higher-touch campaign offers.',
    intent: 'retention' as EmailSegment['intent'],
    source: 'customers' as SegmentRule['source'],
    condition: 'recent' as SegmentRule['condition'],
    count: 24,
  });
  const [suppressionList, setSuppressionList] = useState<SuppressionEntry[]>(() => readJson<SuppressionEntry[]>('easel_email_suppressions', []));
  const [suppressionEmail, setSuppressionEmail] = useState('');
  const [suppressionReason, setSuppressionReason] = useState<SuppressionReason>('manual');
  const [suppressionNotes, setSuppressionNotes] = useState('');
  const [provider, setProvider] = useState(() => localStorage.getItem('easel_email_provider') || 'resend');
  const [fromName, setFromName] = useState(() => localStorage.getItem('easel_email_from_name') || 'Lake Tahoe Paint & Sip');
  const [fromEmail, setFromEmail] = useState(() => localStorage.getItem('easel_email_from_email') || 'hello@paintandsip.local');
  const [replyTo, setReplyTo] = useState(() => localStorage.getItem('easel_email_reply_to') || 'events@paintandsip.local');
  const [sendingDomain, setSendingDomain] = useState(() => localStorage.getItem('easel_email_domain') || 'paintandsip.local');
  const [ownerApprovalRequired, setOwnerApprovalRequired] = useState(() => localStorage.getItem('easel_email_owner_approval') !== 'false');
  const [recoveryEnabled, setRecoveryEnabled] = useState(() => localStorage.getItem('easel_recovery_enabled') !== 'false');
  const [recoveryWaitMinutes, setRecoveryWaitMinutes] = useState(() => Number(localStorage.getItem('easel_recovery_wait_minutes')) || 60);
  const [recoveryStopOnCompletion, setRecoveryStopOnCompletion] = useState(() => localStorage.getItem('easel_recovery_stop_on_completion') !== 'false');
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [aiGeneratingSubject, setAiGeneratingSubject] = useState(false);
  const [aiGeneratingContent, setAiGeneratingContent] = useState(false);
  const [aiGeneratingVariant, setAiGeneratingVariant] = useState(false);
  const backendAvailable = data?.backendConnected ?? false;

  // Load workspace + DB data on mount
  useEffect(() => {
    if (workspaceLoaded || !settingsRows) return;
    const row = (settingsRows as Setting[]).find((setting) => setting.key === 'email_center_workspace');
    if (!row?.value) {
      setWorkspaceLoaded(true);
      return;
    }
    try {
      const workspace = typeof row.value === 'string' ? JSON.parse(row.value) as EmailWorkspaceSettings : row.value as EmailWorkspaceSettings;
      if (workspace.templates?.length) setEditableTemplates(workspace.templates);
      if (workspace.templateVersions) setTemplateVersions(workspace.templateVersions);
      if (workspace.customSegments) setCustomSegments(workspace.customSegments);
      if (workspace.suppressionList) setSuppressionList(workspace.suppressionList);
      if (workspace.brandStyles) setBrandStyles(workspace.brandStyles);
      if (workspace.providerSettings) {
        setProvider(workspace.providerSettings.provider || 'resend');
        setFromName(workspace.providerSettings.fromName || 'Lake Tahoe Paint & Sip');
        setFromEmail(workspace.providerSettings.fromEmail || 'hello@paintandsip.local');
        setReplyTo(workspace.providerSettings.replyTo || 'events@paintandsip.local');
        setSendingDomain(workspace.providerSettings.sendingDomain || 'paintandsip.local');
        setOwnerApprovalRequired(workspace.providerSettings.ownerApprovalRequired !== false);
      }
    } catch {
      // Local fallback remains available if the settings payload is malformed.
    } finally {
      setWorkspaceLoaded(true);
    }
  }, [settingsRows, workspaceLoaded]);

  // Initial load from DB tables when backend is connected
  useEffect(() => {
    if (!backendAvailable || editableTemplates.length > 0) return;
    const loadFromDb = async () => {
      // Load templates from email_templates
      const { data: dbTemplates } = await supabase
        .from('email_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (dbTemplates && dbTemplates.length > 0) {
        const mapped: EmailTemplate[] = dbTemplates.map((t: Record<string, unknown>) => ({
          id: String(t.id),
          name: String(t.name ?? ''),
          type: (String(t.template_type ?? 'marketing')) as EmailTemplateType,
          trigger: String(t.trigger_name ?? 'manual'),
          subject: String(t.subject ?? ''),
          previewText: String(t.preview_text ?? ''),
          body: String(t.html_body ?? ''),
          updatedAt: String(t.updated_at ?? new Date().toISOString()),
          enabled: Boolean(t.is_active ?? true),
        }));
        setEditableTemplates(mapped);
      }

      // Load suppression from email_suppression_list
      const { data: dbSuppressions } = await supabase
        .from('email_suppression_list')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbSuppressions) {
        const mapped: SuppressionEntry[] = dbSuppressions.map((s: Record<string, unknown>) => ({
          id: String(s.id),
          email: String(s.email),
          reason: String(s.reason) as SuppressionReason,
          notes: String(s.notes ?? ''),
          createdAt: String(s.created_at ?? new Date().toISOString()),
        }));
        setSuppressionList(mapped);
      }
    };
    void loadFromDb();
  }, [backendAvailable]);

  useEffect(() => {
    if (!data || editableTemplates.length > 0) return;
    setEditableTemplates(data.templates);
  }, [data, editableTemplates.length]);

  useEffect(() => {
    const raw = localStorage.getItem(RECOVERY_DRAFT_STORAGE_KEY);
    if (!raw || !data) return;
    try {
      const draft = JSON.parse(raw) as RecoveryCampaignDraft;
      setCampaignName(draft.name || 'Abandoned checkout recovery');
      setSubject(draft.subject || 'Still thinking about your paint night?');
      setBody(draft.body || 'Hi {{first_name}}, your seats are not reserved yet.');
      setSelectedAudienceId('abandoned-checkout-leads');
      setTrackingSource('email');
      setTrackingMedium('automation');
      setTrackingCampaign('abandoned-checkout-recovery');
      setTrackingContent('recovery-cta');
      setApprovalNote('Recovery draft created from abandoned checkout analytics. Confirm suppression and completion checks before sending.');
      setActiveTab('campaigns');
      localStorage.removeItem(RECOVERY_DRAFT_STORAGE_KEY);
      showToast(`Loaded abandoned checkout recovery draft${draft.recipientCount ? ` for ${draft.recipientCount} recipient${draft.recipientCount === 1 ? '' : 's'}` : ''}`);
    } catch {
      localStorage.removeItem(RECOVERY_DRAFT_STORAGE_KEY);
    }
  }, [data, showToast]);

  const recoveryOpportunities = useMemo(() => {
    const analytics = readLocalAnalyticsEvents();
    const completedKeys = new Set(analytics
      .filter((event) => event.eventName === 'checkout_complete')
      .map((event) => `${event.sessionId}:${typeof event.properties.eventId === 'string' ? event.properties.eventId : ''}`));
    const rows = analytics
      .filter((event) => event.eventName === 'checkout_abandoned')
      .filter((event) => {
        const eventId = typeof event.properties.eventId === 'string' ? event.properties.eventId : '';
        const email = typeof event.properties.purchaserEmail === 'string' ? event.properties.purchaserEmail : event.userEmail;
        return Boolean(email) && (!recoveryStopOnCompletion || !completedKeys.has(`${event.sessionId}:${eventId}`));
      });
    const uniqueEmails = new Set(rows.map((event) => (
      typeof event.properties.purchaserEmail === 'string' ? event.properties.purchaserEmail : event.userEmail || ''
    ).toLowerCase()).filter(Boolean));
    const potentialValue = rows.reduce((sum, event) => sum + (typeof event.properties.amountDue === 'number' ? event.properties.amountDue : 0), 0);
    return { rows, uniqueEmails, potentialValue };
  }, [recoveryStopOnCompletion]);

  const allSegments = useMemo<EmailSegment[]>(() => {
    const savedSegments = customSegments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      count: segment.count,
      intent: segment.intent,
    }));
    const abandonedSegment: EmailSegment = {
      id: 'abandoned-checkout-leads',
      name: 'Abandoned Checkout Leads',
      description: 'Guests who started checkout and left before booking.',
      count: recoveryOpportunities.uniqueEmails.size,
      intent: 'revenue',
    };
    const baseSegments = data?.segments || [];
    const hasAbandonedSegment = baseSegments.some((segment) => segment.id === abandonedSegment.id);
    return [...baseSegments, ...(hasAbandonedSegment ? [] : [abandonedSegment]), ...savedSegments];
  }, [customSegments, data?.segments, recoveryOpportunities.uniqueEmails.size]);

  const selectedAudience = useMemo(
    () => allSegments.find((segment) => segment.id === selectedAudienceId) || allSegments[0],
    [allSegments, selectedAudienceId]
  );

  const sendSimulation = useMemo(() => {
    const audienceCount = selectedAudience?.count || 0;
    const suppressedCount = Math.min(suppressionList.length, audienceCount);
    const eligibleCount = Math.max(audienceCount - suppressedCount, 0);
    const holdoutCount = Math.floor(eligibleCount * Math.min(Math.max(holdoutPercent, 0), 50) / 100);
    const deliverableCount = Math.max(eligibleCount - holdoutCount, 0);
    const testPercent = abTestEnabled ? Math.min(Math.max(abSplitPercent, 5), 50) : 0;
    const testPool = Math.floor(deliverableCount * testPercent / 100);
    const variantACount = abTestEnabled ? Math.floor(testPool / 2) : deliverableCount;
    const variantBCount = abTestEnabled ? testPool - variantACount : 0;
    const winnerCount = abTestEnabled ? Math.max(deliverableCount - testPool, 0) : 0;
    const issues = [
      !selectedAudience ? 'Choose an audience' : '',
      audienceCount === 0 ? 'Audience has no recipients' : '',
      abTestEnabled && !subjectVariantB.trim() ? 'Add subject variant B' : '',
      campaignSendMode === 'schedule' && !scheduledAt ? 'Pick a scheduled send time' : '',
      !subject.trim() ? 'Add a subject line' : '',
    ].filter(Boolean);
    return {
      audienceCount,
      suppressedCount,
      eligibleCount,
      holdoutCount,
      deliverableCount,
      variantACount,
      variantBCount,
      winnerCount,
      issues,
    };
  }, [abSplitPercent, abTestEnabled, campaignSendMode, holdoutPercent, scheduledAt, selectedAudience, subject, subjectVariantB, suppressionList.length]);

  const trackingParams = useMemo<TrackingParams>(() => ({
    source: trackingSource,
    medium: trackingMedium,
    campaign: trackingCampaign || slugify(campaignName || 'email-campaign'),
    content: trackingContent || selectedAudienceId,
  }), [campaignName, selectedAudienceId, trackingCampaign, trackingContent, trackingMedium, trackingSource]);

  const trackedLinkPreview = useMemo(() => buildTrackedUrl('{{event_url}}', trackingParams), [trackingParams]);

  useEffect(() => {
    if (!trackingCampaign.trim() && campaignName.trim()) {
      setTrackingCampaign(slugify(campaignName));
    }
  }, [campaignName, trackingCampaign]);

  const automationReadiness = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Transactional basics',
        detail: 'Order confirmations, payment follow-ups, reminders, and cancellations.',
        ready: editableTemplates.some((template) => template.id.includes('order')) && data.automations.some((automation) => automation.trigger.toLowerCase().includes('order')),
      },
      {
        label: 'Revenue nudges',
        detail: 'Gift card reminders, lapsed customers, memberships, and low-fill event campaigns.',
        ready: editableTemplates.some((template) => template.name.toLowerCase().includes('gift')) || allSegments.some((segment) => segment.intent === 'revenue'),
      },
      {
        label: 'Owner safeguards',
        detail: 'Draft mode, suppression handling, consent checks, and send history.',
        ready: data.backendConnected,
      },
    ];
  }, [allSegments, data, editableTemplates]);

  const handleQueueCampaign = async () => {
    if (!selectedAudience || !campaignName.trim() || !subject.trim()) {
      showToast('Campaign name, subject, and audience are required');
      return;
    }
    if (sendSimulation.issues.length) {
      showToast(`Review before queueing: ${sendSimulation.issues[0]}`);
      return;
    }
    try {
      const testingNote = abTestEnabled
        ? `\nA/B test: ${abSplitPercent}% test pool split between "${subject.trim()}" and "${subjectVariantB.trim()}"; winner by ${winningMetric.replace('_', ' ')}.`
        : '\nA/B test: off.';
      await queueCampaign.mutateAsync({
        name: campaignName.trim(),
        subject: subject.trim(),
        audience: `${selectedAudience.name}${campaignSendMode === 'schedule' && scheduledAt ? ` · scheduled ${scheduledAt}` : ''}`,
        recipientCount: sendSimulation.deliverableCount,
        scheduledAt: campaignSendMode === 'schedule' ? scheduledAt : null,
        body: `${body}\n\n---\nApproval note: ${approvalNote}${testingNote}\nTracking: ${trackedLinkPreview}\nSend simulation: ${sendSimulation.deliverableCount} deliverable, ${sendSimulation.suppressedCount} suppressed, ${sendSimulation.holdoutCount} holdout.`,
      });
      showToast('Campaign queued for review');
      setActiveTab('campaigns');
    } catch (error) {
      showToast(`Could not queue campaign: ${getErrorMessage(error)}`);
    }
  };

  const loadAbandonedCheckoutRecovery = () => {
    setCampaignName('Abandoned checkout recovery');
    setSubject('Still thinking about {{event_title}}?');
    setBody(`Hi {{first_name}},

You started booking {{event_title}}, but your seats are not reserved yet.

If you still want to join us, finish your booking here:
{{checkout_url}}

Need help or have a question before booking? Just reply to this email and we will help you out.

See you at the studio,
{{studio_name}}`);
    setSelectedAudienceId('abandoned-checkout-leads');
    setTrackingSource('email');
    setTrackingMedium('automation');
    setTrackingCampaign('abandoned-checkout-recovery');
    setTrackingContent('recovery-cta');
    setCampaignSendMode('queue');
    setApprovalNote(`Send only after ${recoveryWaitMinutes} minutes. Respect suppression/preferences. ${recoveryStopOnCompletion ? 'Skip anyone who completed a later booking.' : 'Completion dedupe is off in this demo config.'}`);
    setActiveTab('campaigns');
    showToast('Loaded abandoned checkout recovery into the campaign builder');
  };

  const handleSaveRecoveryAutomation = () => {
    localStorage.setItem('easel_recovery_enabled', String(recoveryEnabled));
    localStorage.setItem('easel_recovery_wait_minutes', String(recoveryWaitMinutes));
    localStorage.setItem('easel_recovery_stop_on_completion', String(recoveryStopOnCompletion));
    showToast('Abandoned checkout automation settings saved locally');
  };

  const applyCampaignTracking = () => {
    const links = extractHtmlLinks(body);
    if (links.length) {
      setBody(addTrackingToHtmlLinks(body, trackingParams));
      showToast(`Added UTM tracking to ${links.length} campaign link${links.length === 1 ? '' : 's'}`);
      return;
    }

    const fallbackLink = buildTrackedUrl('{{event_url}}', trackingParams);
    setBody((draft) => `${draft.trim()}\n\nReserve your seat: ${fallbackLink}`);
    showToast('Added a tracked event link to the campaign draft');
  };

  const applyTrackingToVisualBlock = (id: string, url: string) => {
    updateVisualBlock(id, { url: buildTrackedUrl(url || '{{event_url}}', trackingParams) });
    showToast('Added UTM tracking to this block link');
  };

  const handleUseTemplate = (template: EmailTemplate) => {
    setSelectedTemplateId(template.id);
    setSubject(template.subject);
    setBody(template.body);
    setActiveTab('campaigns');
    showToast(`Loaded ${template.name} into campaign draft`);
  };

  const startEditingTemplate = (template: EmailTemplate) => {
    setTemplateDraft({ ...template });
    setTemplateDirty(false);
    setVisualBlocks(bodyToBlocks(template.body));
  };

  const handleSaveTemplate = async () => {
    if (!templateDraft) return;
    const bodyHtml = visualBlocks.length ? blocksToHtml(visualBlocks, brandStyles) : templateDraft.body;
    const existing = editableTemplates.find((template) => template.id === templateDraft.id);
    if (existing) {
      const version: EmailTemplateVersion = {
        id: `version-${Date.now()}`,
        templateId: templateDraft.id,
        templateName: templateDraft.name,
        subject: existing.subject,
        previewText: existing.previewText,
        body: existing.body,
        savedAt: new Date().toISOString(),
        note: versionNote.trim() || 'Owner edit',
      };
      const nextVersions = [version, ...templateVersions].slice(0, 30);
      setTemplateVersions(nextVersions);
      localStorage.setItem('easel_email_template_versions', JSON.stringify(nextVersions));
    }
    const updated = { ...templateDraft, body: bodyHtml, updatedAt: new Date().toISOString() };
    const next = editableTemplates.map((template) =>
      template.id === templateDraft.id ? updated : template
    );
    const nonexistent = !existing;
    if (nonexistent) next.push(updated);
    setEditableTemplates(next);
    localStorage.setItem('easel_email_templates', JSON.stringify(next));

    // Persist to backend when available
    if (backendAvailable) {
      setSavingTemplate(true);
      const dbPayload = {
        name: updated.name,
        template_type: updated.type,
        trigger_name: updated.trigger === 'manual' ? null : updated.trigger,
        subject: updated.subject,
        preview_text: updated.previewText,
        html_body: bodyHtml,
        is_active: updated.enabled ?? true,
      };
      const dbOp = nonexistent
        ? supabase.from('email_templates').insert(dbPayload)
        : supabase.from('email_templates').update(dbPayload).eq('id', updated.id);
      const { error: dbError } = await dbOp;
      setSavingTemplate(false);
      if (dbError) {
        showToast(`Template save failed: ${getErrorMessage(dbError)}`);
        return;
      }
      showToast('Template saved to database');
    } else {
      showToast('Template saved locally');
    }

    setTemplateDirty(false);
    setTemplateDraft(null);
    setVersionNote('Owner edit');
  };

  const handleDeleteTemplate = async () => {
    const template = deleteConfirmTemplate;
    if (!template) return;
    const next = editableTemplates.filter((t) => t.id !== template.id);
    setEditableTemplates(next);
    localStorage.setItem('easel_email_templates', JSON.stringify(next));
    if (backendAvailable) {
      const { error: dbError } = await supabase.from('email_templates').delete().eq('id', template.id);
      if (dbError && !dbError.message?.includes('not found')) {
        showToast(`Template delete failed: ${getErrorMessage(dbError)}`);
      }
    }
    if (templateDraft?.id === template.id) {
      setTemplateDraft(null);
    }
    setDeleteConfirmTemplate(null);
    showToast('Template deleted');
  };

  const handleCancelTemplateEdit = () => {
    if (templateDirty && templateDraft) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    setTemplateDraft(null);
  };

  const handleRestoreVersion = (version: EmailTemplateVersion) => {
    setTemplateDraft((draft) => draft
      ? { ...draft, subject: version.subject, previewText: version.previewText, body: version.body }
      : null
    );
    setVisualBlocks(bodyToBlocks(version.body));
    showToast('Version restored into editor');
  };

  const addVisualBlock = (type: EmailBlockType) => {
    setTemplateDirty(true);
    const defaults: Record<EmailBlockType, EmailBlock> = {
      hero: { id: `block-${Date.now()}`, type, eyebrow: 'This week at the studio', content: 'Your next creative night is waiting', secondaryContent: 'Gather your favorite people and join us for a relaxed paint-and-sip workshop.', align: 'center', backgroundColor: '#fff7ed', accentColor: '#f97316', padding: 'spacious' },
      heading: { id: `block-${Date.now()}`, type, content: 'A fresh night out is waiting', align: 'center' },
      text: { id: `block-${Date.now()}`, type, content: 'Add your message here. You can use merge tags like {{first_name}}, {{event_title}}, and {{credit_count}}.', align: 'left' },
      button: { id: `block-${Date.now()}`, type, content: 'Reserve your seat', url: '{{event_url}}', align: 'center' },
      image: { id: `block-${Date.now()}`, type, content: 'Paint and sip event', url: 'https://placehold.co/1200x675?text=Paint+%26+Sip', align: 'center' },
      divider: { id: `block-${Date.now()}`, type, content: '', align: 'center' },
      spacer: { id: `block-${Date.now()}`, type, content: '', align: 'center', padding: 'normal' },
      promo: { id: `block-${Date.now()}`, type, eyebrow: 'Limited offer', content: 'Save 15% this weekend', secondaryContent: 'Use code PAINT15 at checkout before seats fill up.', align: 'center', backgroundColor: '#fff7ed', accentColor: '#f97316', padding: 'normal' },
      event: { id: `block-${Date.now()}`, type, eyebrow: '{{event_datetime}}', content: '{{event_title}}', secondaryContent: 'A guided workshop with everything included.', url: '{{event_url}}', align: 'left', accentColor: '#f97316', padding: 'normal' },
      columns: { id: `block-${Date.now()}`, type, content: 'All supplies included||Beginner friendly instruction', align: 'left', backgroundColor: '#f9fafb', padding: 'normal' },
    };
    const block = defaults[type];
    setVisualBlocks((blocks) => [...blocks, block]);
    setSelectedBlockId(block.id);
  };

  const generateTemplateSubject = async () => {
    setAiGeneratingSubject(true);
    try {
      const result = await callAiGateway({
        task: 'email_subject',
        messages: [
          { role: 'system', content: 'You are an email marketing copywriter for a paint-and-sip studio. Generate a compelling subject line (max 60 chars) and preview text. Return JSON: {"subject": "...", "preheader": "..."}' },
          { role: 'user', content: templateDraft?.name ? `Generate a subject line for an email template called "${templateDraft.name}"` : 'Generate a paint-and-sip email subject line' },
        ],
        maxTokens: 200,
      });
      if (result.content) {
        try {
          const parsed = JSON.parse(result.content);
          if (parsed.subject) setTemplateDraft(prev => prev ? { ...prev, subject: parsed.subject, previewText: parsed.preheader || prev.previewText } : prev);
          showToast('Subject line generated!');
          return;
        } catch {
          setTemplateDraft(prev => prev ? { ...prev, subject: result.content!.slice(0, 60) } : prev);
          showToast('Subject line generated!');
          return;
        }
      }
      showToast('Failed to generate subject line', 'error');
    } catch {
      showToast('Failed to generate subject line', 'error');
    } finally {
      setAiGeneratingSubject(false);
    }
  };

  const generateTemplateContent = async () => {
    setAiGeneratingContent(true);
    try {
      const result = await callAiGateway({
        task: 'email_content',
        messages: [
          { role: 'system', content: 'You write email body content for a paint-and-sip studio. Return plain text email body (HTML not needed). Be warm and engaging.' },
          { role: 'user', content: templateDraft?.name ? `Write an email body for "${templateDraft.name}" template. Keep it concise and friendly.` : 'Write a friendly paint-and-sip promotional email body.' },
        ],
        maxTokens: 600,
      });
      if (result.content) {
        setTemplateDraft(prev => prev ? { ...prev, body: result.content ?? prev.body } : prev);
        setVisualBlocks(bodyToBlocks(result.content));
        showToast('Content generated!');
      } else {
        showToast('Failed to generate content', 'error');
      }
    } catch {
      showToast('Failed to generate content', 'error');
    } finally {
      setAiGeneratingContent(false);
    }
  };

  const generateCampaignSubject = async () => {
    setAiGeneratingSubject(true);
    try {
      const result = await callAiGateway({
        task: 'email_subject',
        messages: [
          { role: 'system', content: 'You write email subject lines for a paint-and-sip studio. Max 60 chars. Return JSON: {"subject": "...", "preheader": "..."}' },
          { role: 'user', content: campaignName ? `Write a subject line for a campaign called "${campaignName}"` : 'Write a paint-and-sip email subject line' },
        ],
        maxTokens: 200,
      });
      if (result.content) {
        try {
          const parsed = JSON.parse(result.content);
          if (parsed.subject) setSubject(parsed.subject);
          showToast('Subject generated!');
          return;
        } catch {
          setSubject(result.content.slice(0, 60));
          return;
        }
      }
      showToast('Failed to generate subject', 'error');
    } catch {
      showToast('Failed to generate subject', 'error');
    } finally {
      setAiGeneratingSubject(false);
    }
  };

  const generateCampaignVariant = async () => {
    setAiGeneratingVariant(true);
    try {
      const result = await callAiGateway({
        task: 'email_subject_variant',
        messages: [
          { role: 'system', content: 'You write A/B test subject line variants. Return a single subject line (max 60 chars).' },
          { role: 'user', content: `Write an alternative A/B test subject line for: "${subject}"` },
        ],
        maxTokens: 100,
      });
      if (result.content) {
        setSubjectVariantB(result.content.slice(0, 60));
        showToast('Variant generated!');
      } else {
        showToast('Failed to generate variant', 'error');
      }
    } catch {
      showToast('Failed to generate variant', 'error');
    } finally {
      setAiGeneratingVariant(false);
    }
  };

  const generateCampaignContent = async () => {
    setAiGeneratingContent(true);
    try {
      const result = await callAiGateway({
        task: 'email_content',
        messages: [
          { role: 'system', content: 'You write email body content for a paint-and-sip studio. Return plain text. Be warm and engaging.' },
          { role: 'user', content: campaignName ? `Write a short email body for campaign: ${campaignName}` : 'Write a short promotional email for a paint-and-sip studio.' },
        ],
        maxTokens: 600,
      });
      if (result.content) {
        setBody(result.content);
        showToast('Campaign body generated!');
      } else {
        showToast('Failed to generate content', 'error');
      }
    } catch {
      showToast('Failed to generate content', 'error');
    } finally {
      setAiGeneratingContent(false);
    }
  };

  const updateVisualBlock = (id: string, updates: Partial<EmailBlock>) => {
    setTemplateDirty(true);
    setVisualBlocks((blocks) => blocks.map((block) => block.id === id ? { ...block, ...updates } : block));
  };

  const removeVisualBlock = (id: string) => {
    setTemplateDirty(true);
    setVisualBlocks((blocks) => blocks.filter((block) => block.id !== id));
    if (selectedBlockId === id) setSelectedBlockId('');
  };

  const moveVisualBlock = (id: string, direction: -1 | 1) => {
    setTemplateDirty(true);
    setVisualBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return blocks;
      const next = [...blocks];
      const [block] = next.splice(index, 1);
      next.splice(nextIndex, 0, block);
      return next;
    });
  };

  const handleDropBlock = (targetId: string) => {
    if (!draggedBlockId || draggedBlockId === targetId) return;
    setVisualBlocks((blocks) => {
      const dragged = blocks.find((block) => block.id === draggedBlockId);
      if (!dragged) return blocks;
      const withoutDragged = blocks.filter((block) => block.id !== draggedBlockId);
      const targetIndex = withoutDragged.findIndex((block) => block.id === targetId);
      const next = [...withoutDragged];
      next.splice(targetIndex, 0, dragged);
      return next;
    });
    setDraggedBlockId('');
  };

  const handleSendTestEmail = async () => {
    const email = testEmail.trim().toLowerCase();
    if (!templateDraft || !/\S+@\S+\.\S+/.test(email)) {
      showToast('Enter a valid test recipient email');
      return;
    }

    setSendingTest(true);
    localStorage.setItem('easel_email_test_recipient', email);
    try {
      const html = visualBlocks.length ? blocksToHtml(visualBlocks, brandStyles) : templateDraft.body;
      const { error } = await supabase.functions.invoke('email-test', {
        body: {
          to: email,
          subject: templateDraft.subject,
          html,
          previewText: templateDraft.previewText,
          provider,
        },
      });
      if (error) throw error;
      showToast(`Test email requested for ${email}`);
    } catch (error) {
      showToast(`Test email is not configured yet: ${getErrorMessage(error, 'email-test function unavailable')}`);
    } finally {
      setSendingTest(false);
    }
  };

  const applyEmailPreset = (preset: 'eventPromo' | 'membership' | 'privateEvent') => {
    const id = Date.now();
    const presets: Record<typeof preset, EmailBlock[]> = {
      eventPromo: [
        { id: `block-${id}-1`, type: 'hero', eyebrow: 'New seats opened', content: 'A fresh paint night is on the calendar', secondaryContent: 'Hi {{first_name}}, join us for {{event_title}} and make something worth taking home.', align: 'center', backgroundColor: '#fff7ed', accentColor: '#f97316', padding: 'spacious' },
        { id: `block-${id}-2`, type: 'event', eyebrow: '{{event_datetime}}', content: '{{event_title}}', secondaryContent: 'All materials are included. Bring a friend, pick your seat, and we will handle the rest.', url: '{{event_url}}', accentColor: '#f97316', padding: 'normal' },
        { id: `block-${id}-3`, type: 'button', content: 'Reserve your seat', url: '{{event_url}}', align: 'center', accentColor: '#f97316' },
      ],
      membership: [
        { id: `block-${id}-1`, type: 'hero', eyebrow: 'Membership reminder', content: 'You still have {{credit_count}} credits waiting', secondaryContent: 'Use your monthly credits toward an upcoming public workshop before your next renewal.', align: 'center', backgroundColor: '#ecfdf5', accentColor: '#059669', padding: 'spacious' },
        { id: `block-${id}-2`, type: 'columns', content: 'Use credits at checkout||Book solo or bring a guest', backgroundColor: '#f0fdf4', padding: 'normal' },
        { id: `block-${id}-3`, type: 'button', content: 'Browse eligible events', url: '{{events_url}}', align: 'center', accentColor: '#059669' },
      ],
      privateEvent: [
        { id: `block-${id}-1`, type: 'hero', eyebrow: 'Private event planning', content: 'Let us help shape your paint party', secondaryContent: 'We can help with dates, guest count, painting selection, and a proposal for your group.', align: 'center', backgroundColor: '#eff6ff', accentColor: '#2563eb', padding: 'spacious' },
        { id: `block-${id}-2`, type: 'text', content: 'Hi {{first_name}}, thanks for reaching out about a private event. Reply with any timing or budget notes, and we will prepare the next step.', padding: 'normal' },
        { id: `block-${id}-3`, type: 'button', content: 'View proposal', url: '{{proposal_url}}', align: 'center', accentColor: '#2563eb' },
      ],
    };
    setVisualBlocks(presets[preset]);
    setSelectedBlockId(presets[preset][0]?.id || '');
  };

  const insertMergeTag = (tag: string) => {
    if (!visualBlocks.length) {
      addVisualBlock('text');
      return;
    }
    const lastEditable = [...visualBlocks].reverse().find((block) => block.type !== 'divider' && block.type !== 'image');
    if (!lastEditable) return;
    updateVisualBlock(lastEditable.id, { content: `${lastEditable.content} ${tag}`.trim() });
  };

  const handleCreateTemplate = () => {
    const template: EmailTemplate = {
      id: `template-${Date.now()}`,
      name: 'New campaign template',
      type: 'marketing',
      trigger: 'Manual campaign',
      subject: 'A new paint night is waiting',
      previewText: 'Invite customers back for an upcoming event.',
      body: 'Hi {{first_name}}, we saved a seat for your next creative night out.',
      updatedAt: new Date().toISOString(),
      enabled: true,
    };
    const next = [template, ...editableTemplates];
    setEditableTemplates(next);
    localStorage.setItem('easel_email_templates', JSON.stringify(next));
    startEditingTemplate(template);
  };

  const handleCreateSegment = () => {
    if (!segmentDraft.name.trim()) {
      showToast('Segment name is required');
      return;
    }
    const segment: SegmentRule = {
      id: `segment-${Date.now()}`,
      ...segmentDraft,
      count: Math.max(Number(segmentDraft.count) || 0, 0),
    };
    const next = [segment, ...customSegments];
    setCustomSegments(next);
    localStorage.setItem('easel_email_segments', JSON.stringify(next));
    setSelectedAudienceId(segment.id);
    showToast('CRM segment saved locally');
  };

  const handleDeleteSegment = (id: string) => {
    setDeleteConfirmSegment(id);
  };

  const confirmDeleteSegment = () => {
    if (!deleteConfirmSegment) return;
    const next = customSegments.filter((segment) => segment.id !== deleteConfirmSegment);
    setCustomSegments(next);
    localStorage.setItem('easel_email_segments', JSON.stringify(next));
    setDeleteConfirmSegment(null);
  };

  const handleAddSuppression = async () => {
    const email = suppressionEmail.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(email)) {
      showToast('Enter a valid email to suppress');
      return;
    }
    const entry: SuppressionEntry = {
      id: `suppression-${Date.now()}`,
      email,
      reason: suppressionReason,
      notes: suppressionNotes.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...suppressionList.filter((item) => item.email !== email)];
    setSuppressionList(next);
    localStorage.setItem('easel_email_suppressions', JSON.stringify(next));

    if (backendAvailable) {
      setSuppressing(true);
      const { error: dbError } = await supabase.from('email_suppression_list').insert({
        email,
        reason: suppressionReason,
        notes: suppressionNotes.trim(),
      });
      setSuppressing(false);
      if (dbError) {
        showToast(`Suppression save failed: ${getErrorMessage(dbError)}`);
        return;
      }
    }

    setSuppressionEmail('');
    setSuppressionNotes('');
    showToast('Email added to suppression list');
  };

  const handleRemoveSuppression = async (id: string) => {
    const entry = suppressionList.find((item) => item.id === id);
    const next = suppressionList.filter((item) => item.id !== id);
    setSuppressionList(next);
    localStorage.setItem('easel_email_suppressions', JSON.stringify(next));

    if (backendAvailable && entry) {
      const { error: dbError } = await supabase.from('email_suppression_list').delete().eq('email', entry.email);
      if (dbError) {
        showToast(`Suppression remove failed: ${getErrorMessage(dbError)}`);
        return;
      }
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('easel_email_provider', provider);
    localStorage.setItem('easel_email_from_name', fromName);
    localStorage.setItem('easel_email_from_email', fromEmail);
    localStorage.setItem('easel_email_reply_to', replyTo);
    localStorage.setItem('easel_email_domain', sendingDomain);
    localStorage.setItem('easel_email_owner_approval', String(ownerApprovalRequired));
    localStorage.setItem('easel_email_brand_styles', JSON.stringify(brandStyles));
    localStorage.setItem('easel_email_ab_test_enabled', String(abTestEnabled));
    localStorage.setItem('easel_email_subject_variant_b', subjectVariantB);
    localStorage.setItem('easel_email_ab_split_percent', String(abSplitPercent));
    localStorage.setItem('easel_email_winning_metric', winningMetric);
    localStorage.setItem('easel_email_holdout_percent', String(holdoutPercent));
    localStorage.setItem('easel_email_utm_source', trackingSource);
    localStorage.setItem('easel_email_utm_medium', trackingMedium);
    localStorage.setItem('easel_email_utm_campaign', trackingCampaign);
    localStorage.setItem('easel_email_utm_content', trackingContent);
    if (backendAvailable) handleSaveWorkspace();
    else showToast('Email settings saved locally');
  };

  const handleSaveBrandStyles = () => {
    localStorage.setItem('easel_email_brand_styles', JSON.stringify(brandStyles));
    if (backendAvailable) handleSaveWorkspace();
    else showToast('Brand styles saved locally');
  };

  const handleSaveSmsTemplate = async () => {
    if (!smsTemplateDraft) return;
    if (!smsTemplateDraft.name.trim()) { showToast('Template name is required', 'error'); return; }
    if (!smsTemplateDraft.body.trim()) { showToast('Message body is required', 'error'); return; }
    try {
      await saveSmsTemplate.mutateAsync({
        id: smsTemplateDraft.id.startsWith('new-') ? undefined : smsTemplateDraft.id,
        name: smsTemplateDraft.name,
        templateType: smsTemplateDraft.templateType,
        triggerName: smsTemplateDraft.triggerName,
        body: smsTemplateDraft.body,
        isActive: smsTemplateDraft.isActive,
      });
      showToast('SMS template saved');
      setSmsTemplateDraft(null);
    } catch (err) {
      showToast(`Failed to save template: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handleDeleteSmsTemplate = async () => {
    if (!deleteConfirmSmsTemplate) return;
    try {
      await deleteSmsTemplate.mutateAsync(deleteConfirmSmsTemplate.id);
      showToast('SMS template deleted');
      setDeleteConfirmSmsTemplate(null);
    } catch (err) {
      showToast(`Failed to delete template: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handleSendSms = async () => {
    const recipients = smsTestRecipients
      .split(/[\n,]/)
      .map((r) => r.trim())
      .filter(Boolean);
    const usingAudience = recipients.length === 0;
    if (usingAudience && !smsAudience) { showToast('Add recipients or pick an audience', 'error'); return; }
    if (!smsSendBody.trim()) { showToast('Message body is required', 'error'); return; }
    setSmsSending(true);
    try {
      const result = await sendSms.mutateAsync({
        body: smsSendBody,
        recipients,
        audienceKey: usingAudience ? smsAudience : undefined,
        campaignName: 'Manual SMS send',
      });
      const sent = (result as { sent?: number })?.sent ?? 0;
      const dry = (result as { dryRun?: boolean })?.dryRun;
      showToast(dry ? `Dry run: ${sent} message(s) would send` : `${sent} message(s) sent`);
      setSmsSendBody('');
      setSmsTestRecipients('');
    } catch (err) {
      showToast(`SMS send failed: ${getErrorMessage(err, 'sms-worker function unavailable')}`, 'error');
    } finally {
      setSmsSending(false);
    }
  };

  const workspaceSnapshot = (): EmailWorkspaceSettings => ({
    templates: editableTemplates,
    templateVersions,
    customSegments,
    suppressionList,
    brandStyles,
    providerSettings: {
      provider,
      fromName,
      fromEmail,
      replyTo,
      sendingDomain,
      ownerApprovalRequired,
    },
  });

  const handleSaveWorkspace = async () => {
    try {
      await updateSetting.mutateAsync({
        key: 'email_center_workspace',
        value: JSON.stringify(workspaceSnapshot()),
      });
      showToast('Email workspace synced to backend settings');
    } catch (error) {
      showToast(`Could not sync workspace: ${getErrorMessage(error)}`);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Failed to load email center</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {error instanceof Error ? error.message : 'Unknown error. Check your connection and Supabase configuration.'}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data) return <LoadingSpinner />;

  const activeAutomations = data.automations.filter((automation) => automation.status === 'active').length;
  const enabledTemplates = editableTemplates.filter((template) => template.enabled).length;
  const approvedCampaigns = data.campaigns.filter((campaign) => campaign.status === 'approved');
  const queuedCampaigns = data.campaigns.filter((campaign) => ['queued', 'scheduled', 'draft'].includes(campaign.status));
  const galleryImages = galleries.flatMap((gallery) => (gallery.images || []).map((image) => ({
    ...image,
    galleryName: gallery.name,
  }))).slice(0, 12);
  const currentHtml = templateDraft ? (visualBlocks.length ? blocksToHtml(visualBlocks, brandStyles) : templateDraft.body) : '';
  const currentLinks = extractHtmlLinks(currentHtml);
  const deliverabilityItems = templateDraft ? [
    {
      label: 'Subject length',
      ready: templateDraft.subject.length >= 20 && templateDraft.subject.length <= 70,
      detail: `${templateDraft.subject.length} characters. Aim for 20-70.`,
    },
    {
      label: 'Preview text',
      ready: templateDraft.previewText.length >= 35 && templateDraft.previewText.length <= 140,
      detail: `${templateDraft.previewText.length} characters. Aim for 35-140.`,
    },
    {
      label: 'Preference link',
      ready: currentHtml.includes('{{unsubscribe_url}}'),
      detail: 'Marketing emails should include a preference/unsubscribe link.',
    },
    {
      label: 'Primary CTA',
      ready: visualBlocks.some((block) => block.type === 'button') || currentLinks.length > 0,
      detail: `${currentLinks.length} tracked link${currentLinks.length === 1 ? '' : 's'} found.`,
    },
    {
      label: 'Image balance',
      ready: visualBlocks.filter((block) => block.type === 'image').length <= 3,
      detail: `${visualBlocks.filter((block) => block.type === 'image').length} image block${visualBlocks.filter((block) => block.type === 'image').length === 1 ? '' : 's'}.`,
    },
  ] : [];
  const deliverabilityChecks = [
    {
      label: 'Provider selected',
      detail: `${providerLabel(provider)} is selected for backend delivery.`,
      ready: Boolean(provider),
    },
    {
      label: 'Sender identity',
      detail: `${fromName} <${fromEmail}> with replies to ${replyTo}.`,
      ready: /\S+@\S+\.\S+/.test(fromEmail) && /\S+@\S+\.\S+/.test(replyTo),
    },
    {
      label: 'Sending domain',
      detail: `${sendingDomain} should have SPF, DKIM, and DMARC verified.`,
      ready: Boolean(sendingDomain) && !sendingDomain.endsWith('.local'),
    },
    {
      label: 'Suppression controls',
      detail: `${suppressionList.length} suppressed address${suppressionList.length === 1 ? '' : 'es'} tracked in workspace.`,
      ready: true,
    },
    {
      label: 'Approved campaign queue',
      detail: `${approvedCampaigns.length} approved campaign${approvedCampaigns.length === 1 ? '' : 's'} ready for worker pickup.`,
      ready: approvedCampaigns.length > 0,
    },
  ];

  return (
    <FeatureGate feature="email_marketing" showUpgradeCard upgradeTitle="Email Center" upgradeDescription="Upgrade to Growth or Pro to access email campaigns, automations, and templates.">
    <>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Email Center</h1>
            <Badge variant={data.backendConnected ? 'success' : 'warning'}>
              {data.backendConnected ? 'Broadcast table connected' : 'Demo fallback'}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl" style={{ color: 'var(--text-muted)' }}>
            Manage transactional emails, owner-approved campaigns, customer segments, and automation rules from one admin workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSaveWorkspace} disabled={updateSetting.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateSetting.isPending ? 'Syncing...' : 'Sync Workspace'}
          </Button>
          <Button onClick={() => setActiveTab('campaigns')}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Send} label="Sends 30d" value={data.performance.sends30d.toLocaleString()} detail={`${activeAutomations} active automations`} />
        <MetricCard icon={Mail} label="Open Rate" value={`${data.performance.openRate}%`} detail="Across automations and campaigns" />
        <MetricCard icon={MousePointerClick} label="Click Rate" value={`${data.performance.clickRate}%`} detail="Needs provider webhook data" />
        <MetricCard icon={BarChart3} label="Attributed Revenue" value={formatCurrency(data.performance.revenueAttributed)} detail="Estimated from orders" />
        <MetricCard icon={ShieldCheck} label="Templates Ready" value={`${enabledTemplates}/${editableTemplates.length}`} detail="Transactional and marketing" />
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-1" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--primary-color)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {activeTab === 'overview' && (
        <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-7">
            <CardHeader>
              <CardTitle>Email System Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workflowSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--primary-color)' }}>
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="col-span-12 space-y-6 xl:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Readiness Check</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {automationReadiness.map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      {item.ready ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />
                      ) : (
                        <Clock className="mt-0.5 h-5 w-5 text-yellow-500" />
                      )}
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suggested Next Builds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>Provider integration: {providerLabel(provider)} for actual delivery.</p>
                  <p>Webhook ingestion: delivery, bounce, complaint, open, click, and unsubscribe events.</p>
                  <p>Template variables: event, customer, order, credit, gift card, and private request merge fields.</p>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="inline-flex items-center text-sm font-semibold"
                    style={{ color: 'var(--primary-color)' }}
                  >
                    Review email safeguards
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'automations' && (
        <div role="tabpanel" id="tabpanel-automations" aria-labelledby="tab-automations" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Abandoned Checkout Recovery</CardTitle>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Queue a recovery email after a guest leaves checkout. Demo mode drafts for owner approval; production should run this server-side.
                  </p>
                </div>
                <Badge variant={recoveryEnabled ? 'success' : 'gray'}>{recoveryEnabled ? 'Enabled' : 'Paused'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Recoverable guests</p>
                        <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{recoveryOpportunities.uniqueEmails.size}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Potential value</p>
                        <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(recoveryOpportunities.potentialValue)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Wait period</p>
                        <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{recoveryWaitMinutes}m</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={recoveryEnabled} onChange={(event) => setRecoveryEnabled(event.target.checked)} className="mt-1" />
                        <span>
                          <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Automation active</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Allow eligible recovery drafts to be queued.</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={recoveryStopOnCompletion} onChange={(event) => setRecoveryStopOnCompletion(event.target.checked)} className="mt-1" />
                        <span>
                          <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Stop if booking completes</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Do not recover someone who came back and ordered.</span>
                        </span>
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr] md:items-end">
                      <Input
                        label="Wait minutes"
                        type="number"
                        min="15"
                        step="15"
                        value={String(recoveryWaitMinutes)}
                        onChange={(event) => setRecoveryWaitMinutes(Math.max(15, Number(event.target.value) || 60))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={loadAbandonedCheckoutRecovery}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Load Recovery Draft
                        </Button>
                        <Button type="button" variant="outline" onClick={handleSaveRecoveryAutomation}>
                          <Save className="mr-2 h-4 w-4" />
                          Save Rules
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" style={{ color: '#d97706' }} />
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Required safeguards</p>
                  </div>
                  <div className="mt-3 space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <p>Respect unsubscribe and suppression list before queueing.</p>
                    <p>Hold the message for the configured wait period.</p>
                    <p>Deduplicate by customer, session, and event.</p>
                    <p>Skip the send when a later checkout completion exists.</p>
                    <p>Keep owner approval on unless Jason wires a trusted transactional worker.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Automation Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search automations..."
                value={filterAutomations}
                onChange={(e) => setFilterAutomations(e.target.value)}
                className="mb-4"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      <th className="px-4 py-3">Automation</th>
                      <th className="px-4 py-3">Trigger</th>
                      <th className="px-4 py-3">Audience</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">30d sends</th>
                      <th className="px-4 py-3">Open rate</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                    {data.automations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <Workflow className="mx-auto h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                          <p className="mt-2 font-semibold" style={{ color: 'var(--text-primary)' }}>No automations configured</p>
                          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Automation rules appear here once triggers like abandoned checkout recovery are set up.</p>
                        </td>
                      </tr>
                    ) : (() => {
                      const matched = data.automations.filter((automation) =>
                        automation.name.toLowerCase().includes(filterAutomations.toLowerCase()) ||
                        automation.trigger.toLowerCase().includes(filterAutomations.toLowerCase())
                      );
                      if (!matched.length) {
                        return (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center">
                              <Search className="mx-auto h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                              <p className="mt-2 font-semibold" style={{ color: 'var(--text-primary)' }}>No automations match your search</p>
                              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Try a different name or trigger.</p>
                            </td>
                          </tr>
                        );
                      }
                      return matched.map((automation) => (
                      <tr key={automation.id}>
                        <td className="px-4 py-4">
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{automation.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Last run {automation.lastRunAt ? formatDateTime(automation.lastRunAt) : 'not yet'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{automation.trigger}</td>
                        <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{automation.audience}</td>
                        <td className="px-4 py-4">
                          <Badge variant={automation.status === 'active' ? 'success' : automation.status === 'paused' ? 'warning' : 'gray'}>
                            {automation.id === 'auto-abandoned-checkout' ? (recoveryEnabled ? 'active' : 'paused') : automation.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{automation.sends30d}</td>
                        <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{automation.openRate}%</td>
                        <td className="px-4 py-4 text-right">
                          <Button variant="ghost" size="sm" onClick={automation.id === 'auto-abandoned-checkout' ? loadAbandonedCheckoutRecovery : undefined}>
                            {automation.id === 'auto-abandoned-checkout' ? <ShoppingCart className="mr-2 h-4 w-4" /> : automation.status === 'active' ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                            {automation.id === 'auto-abandoned-checkout' ? 'Draft' : 'Configure'}
                          </Button>
                        </td>
                      </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div role="tabpanel" id="tabpanel-campaigns" aria-labelledby="tab-campaigns" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-5">
            <CardHeader>
              <CardTitle>Create Campaign Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="campaign-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Campaign name</label>
                <Input id="campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
              </div>
              <div>
                <label htmlFor="campaign-audience" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Audience</label>
                <select
                  id="campaign-audience"
                  value={selectedAudienceId}
                  onChange={(event) => setSelectedAudienceId(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {allSegments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} ({segment.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="campaign-template" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Template</label>
                <select
                  id="campaign-template"
                  value={selectedTemplateId}
                  onChange={(event) => {
                    const template = editableTemplates.find((item) => item.id === event.target.value);
                    setSelectedTemplateId(event.target.value);
                    if (template) {
                      setSubject(template.subject);
                      setBody(template.body);
                    }
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {editableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="campaign-subject" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</label>
                  <Button type="button" variant="ghost" size="sm" onClick={generateCampaignSubject} disabled={aiGeneratingSubject} className="text-primary-500">
                    {aiGeneratingSubject ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    AI Subject
                  </Button>
                </div>
                <Input id="campaign-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={abTestEnabled}
                    onChange={(event) => setAbTestEnabled(event.target.checked)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>A/B test subject line</span>
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>Queue a test pool first, then let the backend worker send the winning subject to the remainder.</span>
                  </span>
                </label>
                {abTestEnabled && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Subject B
                      </label>
                      <Button type="button" variant="ghost" size="sm" onClick={generateCampaignVariant} disabled={aiGeneratingVariant} className="text-primary-500">
                        {aiGeneratingVariant ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        AI Variant
                      </Button>
                    </div>
                    <Input className="mt-1" value={subjectVariantB} onChange={(event) => setSubjectVariantB(event.target.value)} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Test pool
                        <select
                          value={abSplitPercent}
                          onChange={(event) => setAbSplitPercent(Number(event.target.value))}
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                          style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        >
                          <option value={10}>10% of eligible audience</option>
                          <option value={20}>20% of eligible audience</option>
                          <option value={30}>30% of eligible audience</option>
                          <option value={50}>50% of eligible audience</option>
                        </select>
                      </label>
                      <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Winning metric
                        <select
                          value={winningMetric}
                          onChange={(event) => setWinningMetric(event.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                          style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        >
                          <option value="click_rate">Click rate</option>
                          <option value="open_rate">Open rate</option>
                          <option value="conversion_rate">Attributed bookings</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="campaign-body" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Draft body</label>
                  <Button type="button" variant="ghost" size="sm" onClick={generateCampaignContent} disabled={aiGeneratingContent} className="text-primary-500">
                    {aiGeneratingContent ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    AI Write
                  </Button>
                </div>
                <Textarea id="campaign-body" value={body} onChange={(event) => setBody(event.target.value)} rows={8} />
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Campaign link tracking</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Adds UTM tags so `/admin/analytics` can attribute visits, checkouts, and private leads back to this campaign.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={applyCampaignTracking}>
                    <Link2 className="mr-1 h-4 w-4" />
                    Apply tracking
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Source
                    <Input className="mt-1" value={trackingSource} onChange={(event) => setTrackingSource(event.target.value)} placeholder="email" />
                  </label>
                  <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Medium
                    <Input className="mt-1" value={trackingMedium} onChange={(event) => setTrackingMedium(event.target.value)} placeholder="campaign" />
                  </label>
                  <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Campaign
                    <Input className="mt-1" value={trackingCampaign} onChange={(event) => setTrackingCampaign(event.target.value)} placeholder="weekend-seats-promo" />
                  </label>
                  <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Content
                    <Input className="mt-1" value={trackingContent} onChange={(event) => setTrackingContent(event.target.value)} placeholder="primary-cta" />
                  </label>
                </div>
                <div className="mt-3 rounded-md border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'var(--admin-input-bg)' }}>
                  Preview: <span className="break-all" style={{ color: 'var(--text-secondary)' }}>{trackedLinkPreview}</span>
                </div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Send readiness simulation</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Estimates the eligible audience before the backend worker applies final consent checks.</p>
                  </div>
                  <Badge variant={sendSimulation.issues.length ? 'warning' : 'success'}>
                    {sendSimulation.issues.length ? 'review' : 'ready'}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3" style={{ color: 'var(--text-muted)' }}>
                  <span>Total audience: {sendSimulation.audienceCount}</span>
                  <span>Suppressed: {sendSimulation.suppressedCount}</span>
                  <span>Deliverable estimate: {sendSimulation.deliverableCount}</span>
                  <span>Holdout: {sendSimulation.holdoutCount}</span>
                  <span>Variant A: {sendSimulation.variantACount}</span>
                  <span>Variant B: {sendSimulation.variantBCount}</span>
                </div>
                {abTestEnabled && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Winner send estimate: {sendSimulation.winnerCount} recipients after the {winningMetric.replace('_', ' ')} winner is selected.
                  </p>
                )}
                <label className="mt-3 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Control holdout
                  <select
                    value={holdoutPercent}
                    onChange={(event) => setHoldoutPercent(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value={0}>No holdout</option>
                    <option value={5}>5% holdout</option>
                    <option value={10}>10% holdout</option>
                    <option value={20}>20% holdout</option>
                  </select>
                </label>
                {sendSimulation.issues.length > 0 && (
                  <div className="mt-3 rounded-lg border p-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--admin-input-bg)' }}>
                    {sendSimulation.issues.map((issue) => (
                      <p key={issue} className="text-xs" style={{ color: 'var(--text-muted)' }}>{issue}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                  <input
                    type="radio"
                    name="send-mode"
                    checked={campaignSendMode === 'queue'}
                    onChange={() => setCampaignSendMode('queue')}
                    className="mt-1 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Queue for approval</span>
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>Best for owner-reviewed marketing sends.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                  <input
                    type="radio"
                    name="send-mode"
                    checked={campaignSendMode === 'schedule'}
                    onChange={() => setCampaignSendMode('schedule')}
                    className="mt-1 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Schedule draft</span>
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>Stores desired send time for backend worker.</span>
                  </span>
                </label>
              </div>
              {campaignSendMode === 'schedule' && (
                <div>
                  <label htmlFor="campaign-schedule" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scheduled send time</label>
                  <Input id="campaign-schedule" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                </div>
              )}
              <div>
                <label htmlFor="campaign-approval" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Approval note</label>
                <Textarea id="campaign-approval" value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} rows={3} />
              </div>
              <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Approval workflow detail</p>
                  <Badge variant={ownerApprovalRequired ? 'warning' : 'gray'}>
                    {ownerApprovalRequired ? 'approval required' : 'approval optional'}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2" style={{ color: 'var(--text-muted)' }}>
                  <span>Reviewer: Demo Owner</span>
                  <span>Audience snapshot: {selectedAudience?.name || 'Select an audience'}</span>
                  <span>Suppression check: {suppressionList.length} blocked</span>
                  <span>Experiment: {abTestEnabled ? `${abSplitPercent}% test pool` : 'none'}</span>
                  <span>Holdout: {holdoutPercent}%</span>
                  <span>Final sample: subject and body saved with campaign</span>
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                {selectedAudience ? `${selectedAudience.count} recipients in ${selectedAudience.name}. ${suppressionList.length} address${suppressionList.length === 1 ? '' : 'es'} currently suppressed. Campaigns should be delivered by a backend worker after consent checks.` : 'Choose an audience to continue.'}
              </div>
              <Button onClick={handleQueueCampaign} disabled={queueCampaign.isPending || sendSimulation.issues.length > 0} className="w-full">
                {campaignSendMode === 'schedule' ? <CalendarClock className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {queueCampaign.isPending ? 'Queueing...' : campaignSendMode === 'schedule' ? 'Queue Scheduled Draft' : 'Queue for Review'}
              </Button>
            </CardContent>
          </Card>

          <Card className="col-span-12 xl:col-span-7">
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search campaigns..."
                value={filterCampaigns}
                onChange={(e) => setFilterCampaigns(e.target.value)}
                className="mb-4"
              />
              {(() => {
                const filtered = data.campaigns.filter((campaign) =>
                  campaign.name.toLowerCase().includes(filterCampaigns.toLowerCase()) ||
                  campaign.status.toLowerCase().includes(filterCampaigns.toLowerCase())
                );
                if (!data.campaigns.length) {
                  return (
                    <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
                      <Sparkles className="mx-auto h-8 w-8" style={{ color: 'var(--primary-color)' }} />
                      <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>No campaigns yet</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Create the first owner-approved campaign draft from the form.</p>
                    </div>
                  );
                }
                if (!filtered.length) {
                  return (
                    <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
                      <Search className="mx-auto h-8 w-8" style={{ color: 'var(--primary-color)' }} />
                      <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>No campaigns match your search</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Try a different name or status.</p>
                    </div>
                  );
                }
                const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
                const safePage = Math.min(campaignPage, Math.max(pageCount, 1));
                const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                return (
                <>
                <div className="space-y-3">
                  {paged.map((campaign) => (
                    <div key={campaign.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{campaign.name}</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{campaign.subject}</p>
                        </div>
                        <Badge variant={campaign.status === 'sent' ? 'success' : campaign.status === 'queued' ? 'primary' : 'gray'}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm md:grid-cols-4" style={{ color: 'var(--text-secondary)' }}>
                        <span>{campaign.audience}</span>
                        <span>{campaign.recipientCount} recipients</span>
                        <span>{campaign.openRate}% open</span>
                        <span>{campaign.clickRate}% click</span>
                      </div>
                      <div className="mt-3 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Approval detail</p>
                          <span>{['approved', 'sent'].includes(campaign.status) ? 'Approved by Demo Owner' : 'Awaiting owner approval'}</span>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <span>Segment snapshot: {campaign.audience}</span>
                          <span>Suppression blocks: {suppressionList.length}</span>
                          <span>Template audit: latest saved version</span>
                        </div>
                        <p className="mt-2">Final sample: {campaign.subject}</p>
                      </div>
                      {['draft', 'scheduled', 'queued'].includes(campaign.status) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateCampaignStatus.mutate({ id: campaign.id, status: 'approved' })}
                            disabled={updateCampaignStatus.isPending}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancelConfirmCampaign(campaign.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination
                  currentPage={safePage}
                  totalPages={pageCount}
                  totalItems={filtered.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCampaignPage}
                />
              </>
              );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'segments' && (
        <div role="tabpanel" id="tabpanel-segments" aria-labelledby="tab-segments" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-4">
            <CardHeader>
              <CardTitle>CRM Segment Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="segment-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Segment name</label>
                <Input id="segment-name" value={segmentDraft.name} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, name: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="segment-desc" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <Textarea id="segment-desc" value={segmentDraft.description} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, description: event.target.value }))} rows={3} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="segment-source" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source</label>
                  <select
                    id="segment-source"
                    value={segmentDraft.source}
                    onChange={(event) => setSegmentDraft((draft) => ({ ...draft, source: event.target.value as SegmentRule['source'] }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="customers">Customers</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="gift_cards">Gift Cards</option>
                    <option value="private_requests">Private Requests</option>
                    <option value="memberships">Memberships</option>
                    <option value="analytics">Analytics</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="segment-intent" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Intent</label>
                  <select
                    id="segment-intent"
                    value={segmentDraft.intent}
                    onChange={(event) => setSegmentDraft((draft) => ({ ...draft, intent: event.target.value as EmailSegment['intent'] }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="revenue">Revenue</option>
                    <option value="retention">Retention</option>
                    <option value="operations">Operations</option>
                    <option value="growth">Growth</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="segment-rule" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Rule</label>
                  <select
                    id="segment-rule"
                    value={segmentDraft.condition}
                    onChange={(event) => setSegmentDraft((draft) => ({ ...draft, condition: event.target.value as SegmentRule['condition'] }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="all">All records</option>
                    <option value="recent">Recent activity</option>
                    <option value="lapsed">Lapsed customers</option>
                    <option value="unredeemed">Unredeemed value</option>
                    <option value="open_leads">Open leads</option>
                    <option value="credits_available">Credits available</option>
                    <option value="abandoned_checkout">Abandoned checkout</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="segment-count" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Estimated count</label>
                  <Input id="segment-count" type="number" min={0} value={segmentDraft.count} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, count: Number(event.target.value) }))} />
                </div>
              </div>
              <Button onClick={handleCreateSegment} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Save CRM Segment
              </Button>
            </CardContent>
          </Card>

          <div className="col-span-12 grid gap-4 md:grid-cols-2 xl:col-span-8">
            <div className="col-span-12">
              <Input
                placeholder="Search segments…"
                value={filterSegments}
                onChange={(event) => setFilterSegments(event.target.value)}
                className="max-w-sm"
              />
            </div>
            {allSegments.length === 0 ? (
              <div className="col-span-12 rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
                <Users className="mx-auto h-8 w-8" style={{ color: 'var(--primary-color)' }} />
                <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>No segments yet</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Create custom segments from the right-side form, or connect your backend for built-in segment data.</p>
              </div>
            ) : (
              (() => {
                const filtered = !filterSegments
                  ? allSegments
                  : allSegments.filter((segment) =>
                      segment.name.toLowerCase().includes(filterSegments.toLowerCase())
                    );
                if (!filtered.length) {
                  return (
                    <div className="col-span-12 rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
                      <Search className="mx-auto h-8 w-8" style={{ color: 'var(--primary-color)' }} />
                      <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>No segments match your search</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Try a different name.</p>
                    </div>
                  );
                }
                return filtered.map((segment) => (
              <Card key={segment.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{segment.description}</p>
                    <h3 className="mt-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{segment.name}</h3>
                  </div>
                  <Badge variant={intentVariant[segment.intent]}>{segment.intent}</Badge>
                </div>
                <p className="mt-5 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{segment.count}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setSelectedAudienceId(segment.id);
                        setActiveTab('campaigns');
                      }}
                      className="inline-flex items-center text-sm font-semibold"
                      style={{ color: 'var(--primary-color)' }}
                    >
                      Draft campaign
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                    {customSegments.some((customSegment) => customSegment.id === segment.id) && (
                      <button
                        onClick={() => handleDeleteSegment(segment.id)}
                        className="inline-flex items-center text-sm font-semibold text-red-600"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
              </CardContent>
            </Card>
            ));
              })()
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div role="tabpanel" id="tabpanel-templates" aria-labelledby="tab-templates" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-5">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Template Editor</CardTitle>
                <Button size="sm" onClick={handleCreateTemplate}>
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templateDraft ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="template-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Template name</label>
                    <Input id="template-name" value={templateDraft.name} onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, name: event.target.value }); }} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label htmlFor="template-type" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
                      <select
                        id="template-type"
                        value={templateDraft.type}
                        onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, type: event.target.value as EmailTemplate['type'] }); }}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <option value="transactional">Transactional</option>
                        <option value="automation">Automation</option>
                        <option value="marketing">Marketing</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="template-trigger" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Trigger</label>
                      <Input id="template-trigger" value={templateDraft.trigger} onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, trigger: event.target.value }); }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="template-subject" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</label>
                      <Button type="button" variant="ghost" size="sm" onClick={generateTemplateSubject} disabled={aiGeneratingSubject} className="text-primary-500">
                        {aiGeneratingSubject ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        AI Subject
                      </Button>
                    </div>
                    <Input id="template-subject" value={templateDraft.subject} onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, subject: event.target.value }); }} />
                  </div>
                  <div>
                    <label htmlFor="template-preview" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Preview text</label>
                    <Input id="template-preview" value={templateDraft.previewText} onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, previewText: event.target.value }); }} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="template-body" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Body</label>
                      <Button type="button" variant="ghost" size="sm" onClick={generateTemplateContent} disabled={aiGeneratingContent} className="text-primary-500">
                        {aiGeneratingContent ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        AI Write
                      </Button>
                    </div>
                    <Textarea id="template-body" value={templateDraft.body} onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, body: event.target.value }); }} rows={10} />
                  </div>
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          <Palette className="h-4 w-4" />
                          Reusable Brand Styles
                        </p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Applies to generated template headers, cards, buttons, and footers.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleSaveBrandStyles}>
                        <Save className="mr-1 h-4 w-4" />
                        Save Styles
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Brand name
                        <Input className="mt-1" value={brandStyles.brandName} onChange={(event) => setBrandStyles((styles) => ({ ...styles, brandName: event.target.value }))} />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Logo URL
                        <Input className="mt-1" value={brandStyles.logoUrl} onChange={(event) => setBrandStyles((styles) => ({ ...styles, logoUrl: event.target.value }))} placeholder="https://..." />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Primary color
                        <Input type="color" className="mt-1 h-9 w-full" value={brandStyles.primaryColor} onChange={(event) => setBrandStyles((styles) => ({ ...styles, primaryColor: event.target.value }))} />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Accent color
                        <Input type="color" className="mt-1 h-9 w-full" value={brandStyles.accentColor} onChange={(event) => setBrandStyles((styles) => ({ ...styles, accentColor: event.target.value }))} />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Email background
                        <Input type="color" className="mt-1 h-9 w-full" value={brandStyles.backgroundColor} onChange={(event) => setBrandStyles((styles) => ({ ...styles, backgroundColor: event.target.value }))} />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Card color
                        <Input type="color" className="mt-1 h-9 w-full" value={brandStyles.cardColor} onChange={(event) => setBrandStyles((styles) => ({ ...styles, cardColor: event.target.value }))} />
                      </label>
                      <label className="text-xs font-semibold md:col-span-2" style={{ color: 'var(--text-muted)' }}>
                        Footer address
                        <Input className="mt-1" value={brandStyles.footerAddress} onChange={(event) => setBrandStyles((styles) => ({ ...styles, footerAddress: event.target.value }))} />
                      </label>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Visual HTML Builder</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add blocks, edit copy, and save provider-ready HTML into the template body.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('hero')}><Sparkles className="mr-1 h-4 w-4" />Hero</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('heading')}><Heading1 className="mr-1 h-4 w-4" />Heading</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('text')}><Type className="mr-1 h-4 w-4" />Text</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('button')}><Link2 className="mr-1 h-4 w-4" />Button</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('image')}><Image className="mr-1 h-4 w-4" />Image</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('divider')}><Minus className="mr-1 h-4 w-4" />Divider</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('promo')}><Percent className="mr-1 h-4 w-4" />Promo</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('event')}><CalendarClock className="mr-1 h-4 w-4" />Event</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addVisualBlock('columns')}><Columns3 className="mr-1 h-4 w-4" />Columns</Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                      <button type="button" onClick={() => applyEmailPreset('eventPromo')} className="rounded-lg border p-3 text-left text-sm font-semibold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        Event promo layout
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Hero, event card, CTA</span>
                      </button>
                      <button type="button" onClick={() => applyEmailPreset('membership')} className="rounded-lg border p-3 text-left text-sm font-semibold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        Membership layout
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Credits, benefits, CTA</span>
                      </button>
                      <button type="button" onClick={() => applyEmailPreset('privateEvent')} className="rounded-lg border p-3 text-left text-sm font-semibold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        Private event layout
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Proposal follow-up</span>
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {mergeTagGroups.map((group) => (
                        <div key={group.label}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{group.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.tags.map((tag) => (
                              <button key={tag} type="button" onClick={() => insertMergeTag(tag)} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 space-y-3">
                      {visualBlocks.map((block, index) => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={() => setDraggedBlockId(block.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDropBlock(block.id)}
                          className="rounded-lg border p-3"
                          style={{ borderColor: selectedBlockId === block.id ? 'var(--primary-color)' : 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', cursor: 'grab' }}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <button type="button" onClick={() => setSelectedBlockId(block.id)}>
                              <Badge variant="gray">{index + 1}. {block.type}</Badge>
                            </button>
                            <div className="flex items-center gap-2">
                              <button type="button" aria-label="Move block up" onClick={() => moveVisualBlock(block.id, -1)} style={{ color: 'var(--text-muted)' }}>Up</button>
                              <button type="button" aria-label="Move block down" onClick={() => moveVisualBlock(block.id, 1)} style={{ color: 'var(--text-muted)' }}>Down</button>
                              <button type="button" aria-label="Remove block" onClick={() => removeVisualBlock(block.id)} className="text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {['hero', 'promo', 'event'].includes(block.type) && (
                            <Input
                              className="mb-3"
                              value={block.eyebrow || ''}
                              onChange={(event) => updateVisualBlock(block.id, { eyebrow: event.target.value })}
                              placeholder="Eyebrow / label"
                            />
                          )}
                          {block.type !== 'divider' && (
                            <Textarea
                              value={block.content}
                              onChange={(event) => updateVisualBlock(block.id, { content: event.target.value })}
                              rows={block.type === 'text' || block.type === 'columns' ? 4 : 2}
                              placeholder={block.type === 'image' ? 'Image alt text' : 'Block content'}
                            />
                          )}
                          {['hero', 'promo', 'event'].includes(block.type) && (
                            <Textarea
                              className="mt-3"
                              value={block.secondaryContent || ''}
                              onChange={(event) => updateVisualBlock(block.id, { secondaryContent: event.target.value })}
                              rows={3}
                              placeholder="Supporting copy"
                            />
                          )}
                          {(block.type === 'button' || block.type === 'image' || block.type === 'event') && (
                            <div className="mt-3 flex flex-col gap-2 md:flex-row">
                              <Input
                                value={block.url || ''}
                                onChange={(event) => updateVisualBlock(block.id, { url: event.target.value })}
                                placeholder={block.type === 'button' ? '{{event_url}}' : 'https://...'}
                              />
                              {(block.type === 'button' || block.type === 'event') && (
                                <Button type="button" size="sm" variant="outline" onClick={() => applyTrackingToVisualBlock(block.id, block.url || '{{event_url}}')}>
                                  <Link2 className="mr-1 h-4 w-4" />
                                  Add UTM
                                </Button>
                              )}
                            </div>
                          )}
                          {block.type === 'image' && galleryImages.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {galleryImages.slice(0, 6).map((image) => (
                                <button
                                  key={image.id}
                                  type="button"
                                  onClick={() => updateVisualBlock(block.id, { url: image.url, content: image.caption || image.galleryName })}
                                  className="overflow-hidden rounded-lg border text-left"
                                  style={{ borderColor: block.url === image.url ? 'var(--primary-color)' : 'var(--border-color)' }}
                                  title={image.caption || image.galleryName}
                                >
                                  <img src={image.url} alt={image.caption || image.galleryName} className="h-16 w-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid gap-2 md:grid-cols-3">
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                              Text
                              <Input className="mt-1" value={block.textColor || ''} onChange={(event) => updateVisualBlock(block.id, { textColor: event.target.value })} placeholder="#111827" />
                            </label>
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                              Accent
                              <Input type="color" className="mt-1 h-8 w-full" value={block.accentColor || '#f97316'} onChange={(event) => updateVisualBlock(block.id, { accentColor: event.target.value })} />
                            </label>
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                              Background
                              <Input type="color" className="mt-1 h-8 w-full" value={block.backgroundColor || '#fff7ed'} onChange={(event) => updateVisualBlock(block.id, { backgroundColor: event.target.value })} />
                            </label>
                          </div>
                          <label className="mt-3 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                            Conditional display
                            <select
                              value={block.condition || ''}
                              onChange={(event) => updateVisualBlock(block.id, { condition: event.target.value || undefined })}
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            >
                              <option value="">Always show</option>
                              <option value="credit_count &gt; 0">Only if membership credits are available</option>
                              <option value="gift_card_balance &gt; 0">Only if gift card balance exists</option>
                              <option value="event_url exists">Only if event URL exists</option>
                              <option value="proposal_url exists">Only for private event proposals</option>
                            </select>
                          </label>
                          {block.type !== 'divider' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant={block.align === 'left' ? 'primary' : 'outline'} onClick={() => updateVisualBlock(block.id, { align: 'left' })}>Left</Button>
                              <Button type="button" size="sm" variant={block.align === 'center' ? 'primary' : 'outline'} onClick={() => updateVisualBlock(block.id, { align: 'center' })}>Center</Button>
                              <Button type="button" size="sm" variant={block.padding === 'compact' ? 'primary' : 'outline'} onClick={() => updateVisualBlock(block.id, { padding: 'compact' })}>Compact</Button>
                              <Button type="button" size="sm" variant={(block.padding || 'normal') === 'normal' ? 'primary' : 'outline'} onClick={() => updateVisualBlock(block.id, { padding: 'normal' })}>Normal</Button>
                              <Button type="button" size="sm" variant={block.padding === 'spacious' ? 'primary' : 'outline'} onClick={() => updateVisualBlock(block.id, { padding: 'spacious' })}>Spacious</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={templateDraft.enabled}
                      onChange={(event) => { setTemplateDirty(true); setTemplateDraft({ ...templateDraft, enabled: event.target.checked }); }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Enabled
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {templateDirty && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Unsaved changes
                      </span>
                    )}
                    <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
                      <Save className="mr-2 h-4 w-4" />
                      {savingTemplate ? 'Saving...' : 'Save Template'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelTemplateEdit}>
                      Cancel
                    </Button>
                  </div>
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Version History</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Each save snapshots the previous subject, preview, and HTML body for restore.</p>
                      </div>
                      {templateVersions.some((v) => v.templateId === templateDraft.id) && (
                        <Input className="max-w-xs" value={versionNote} onChange={(event) => setVersionNote(event.target.value)} placeholder="Save note" />
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      {templateVersions.filter((version) => version.templateId === templateDraft.id).slice(0, 5).length ? (
                        templateVersions.filter((version) => version.templateId === templateDraft.id).slice(0, 5).map((version) => (
                          <div key={version.id} className="flex items-start justify-between gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{version.note}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(version.savedAt)} · {version.subject}</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => handleRestoreVersion(version)}>
                              Restore
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border border-dashed p-3 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                          No saved versions yet. Save once to create the first restore point.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
                  <Edit3 className="mx-auto h-8 w-8" style={{ color: 'var(--primary-color)' }} />
                  <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>Select a template to edit</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Owners can change subject lines, preview text, body copy, trigger labels, and enabled state.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-12 grid gap-4 md:grid-cols-2 xl:col-span-7">
            {templateDraft && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Email Preview</CardTitle>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={previewMode === 'desktop' ? 'primary' : 'outline'} onClick={() => setPreviewMode('desktop')}>Desktop</Button>
                      <Button type="button" size="sm" variant={previewMode === 'mobile' ? 'primary' : 'outline'} onClick={() => setPreviewMode('mobile')}>Mobile</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inbox preview</p>
                    <div className="mt-3 rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-950">{fromName}</p>
                        <span className="text-xs text-slate-400">Now</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{templateDraft.subject || 'Subject line'}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{templateDraft.previewText || 'Preview text will appear here in customer inboxes.'}</p>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Test email</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Uses the `email-test` Supabase function when configured.</p>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
                        <Input className="max-w-xs" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="owner@example.com" />
                        <Button type="button" onClick={handleSendTestEmail} disabled={sendingTest}>
                          <Send className="mr-2 h-4 w-4" />
                          {sendingTest ? 'Sending...' : 'Send Test'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-2 md:grid-cols-2">
                    {deliverabilityItems.map((item) => (
                      <div key={item.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                          <Badge variant={item.ready ? 'success' : 'warning'}>{item.ready ? 'OK' : 'Review'}</Badge>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-sm" style={{ maxWidth: previewMode === 'mobile' ? 390 : 680 }}>
                      <div className="border-b border-slate-200 px-5 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subject</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{templateDraft.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">{templateDraft.previewText}</p>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: visualBlocks.length ? blocksToHtml(visualBlocks, brandStyles) : templateDraft.body }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <Input
              placeholder="Search templates..."
              value={filterTemplates}
              onChange={(e) => setFilterTemplates(e.target.value)}
              className="mb-4"
            />
            {editableTemplates
              .filter((t) => t.name.toLowerCase().includes(filterTemplates.toLowerCase()))
              .map((template) => (
              <Card key={template.id}>
                <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
                      <Badge variant={template.enabled ? 'success' : 'gray'}>{template.enabled ? 'enabled' : 'disabled'}</Badge>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{template.trigger}</p>
                  </div>
                  {template.type === 'transactional' ? <ShieldCheck className="h-5 w-5 text-green-500" /> : template.type === 'marketing' ? <Gift className="h-5 w-5 text-primary-500" /> : <RefreshCw className="h-5 w-5 text-blue-500" />}
                </div>
                <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{template.subject}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{template.previewText}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{template.type}</span>
                  <span>Updated {formatDateTime(template.updatedAt)}</span>
                </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEditingTemplate(template)}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleUseTemplate(template)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Use in Campaign
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmTemplate(template)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
              </CardContent>
            </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'sms' && (
        <div role="tabpanel" id="tabpanel-sms" aria-labelledby="tab-sms" className="grid grid-cols-12 gap-6">
          {/* Stats */}
          <div className="col-span-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Sent (30d)', value: smsData?.performance.sent30d ?? 0, icon: Send },
              { label: 'Delivery rate', value: `${smsData?.performance.deliveryRate ?? 0}%`, icon: CheckCircle2 },
              { label: 'Opted in', value: smsData?.optInCount ?? 0, icon: Users },
              { label: 'Suppressed', value: smsData?.suppressionCount ?? 0, icon: UserMinus },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      <Icon className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                    </div>
                    <div>
                      <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Templates */}
          <Card className="col-span-12 xl:col-span-7">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>SMS Templates</CardTitle>
              <Button
                variant="secondary"
                onClick={() => setSmsTemplateDraft({
                  id: `new-${Date.now()}`,
                  name: '',
                  templateType: 'marketing',
                  triggerName: 'manual',
                  body: '',
                  isActive: true,
                  updatedAt: new Date().toISOString(),
                })}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </CardHeader>
            <CardContent>
              {!smsData?.backendConnected && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    SMS tables not detected. Deploy the <code>sms_system</code> migration and the <code>sms-worker</code> function to enable live sending.
                  </p>
                </div>
              )}
              {smsData?.templates.length ? (
                <div className="space-y-2">
                  {smsData.templates.map((tmpl) => (
                    <div key={tmpl.id} className="flex items-start justify-between gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{tmpl.name}</p>
                          <Badge variant={tmpl.templateType === 'transactional' ? 'primary' : tmpl.templateType === 'marketing' ? 'success' : 'gray'}>{tmpl.templateType}</Badge>
                          {!tmpl.isActive && <Badge variant="gray">paused</Badge>}
                        </div>
                        <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-muted)' }}>{tmpl.body}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{smsSegmentCount(tmpl.body)} segment(s) · {tmpl.body.length} chars · trigger: {tmpl.triggerName}</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSmsTemplateDraft(tmpl)}><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmSmsTemplate(tmpl)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No SMS templates yet. Create one to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send + editor column */}
          <div className="col-span-12 space-y-6 xl:col-span-5">
            {smsTemplateDraft ? (
              <Card>
                <CardHeader>
                  <CardTitle>{smsTemplateDraft.id.startsWith('new-') ? 'New Template' : 'Edit Template'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label htmlFor="sms-tmpl-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
                    <Input id="sms-tmpl-name" value={smsTemplateDraft.name} onChange={(e) => setSmsTemplateDraft({ ...smsTemplateDraft, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="sms-tmpl-type" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
                      <select
                        id="sms-tmpl-type"
                        value={smsTemplateDraft.templateType}
                        onChange={(e) => setSmsTemplateDraft({ ...smsTemplateDraft, templateType: e.target.value as SmsTemplateType })}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <option value="transactional">Transactional</option>
                        <option value="marketing">Marketing</option>
                        <option value="automation">Automation</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sms-tmpl-trigger" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Trigger</label>
                      <Input id="sms-tmpl-trigger" value={smsTemplateDraft.triggerName} onChange={(e) => setSmsTemplateDraft({ ...smsTemplateDraft, triggerName: e.target.value })} placeholder="manual" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sms-tmpl-body" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Message</label>
                    <Textarea id="sms-tmpl-body" rows={4} value={smsTemplateDraft.body} onChange={(e) => setSmsTemplateDraft({ ...smsTemplateDraft, body: e.target.value })} placeholder="Use {{first_name}}, {{event_title}}, etc." />
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{smsSegmentCount(smsTemplateDraft.body)} segment(s) · {smsTemplateDraft.body.length} chars</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={smsTemplateDraft.isActive} onChange={(e) => setSmsTemplateDraft({ ...smsTemplateDraft, isActive: e.target.checked })} className="rounded border-gray-300" />
                    Active
                  </label>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveSmsTemplate} disabled={saveSmsTemplate.isPending}><Save className="mr-2 h-4 w-4" />Save</Button>
                    <Button variant="ghost" onClick={() => setSmsTemplateDraft(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Send SMS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label htmlFor="sms-recipients" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Recipients (optional)</label>
                    <Textarea id="sms-recipients" rows={2} value={smsTestRecipients} onChange={(e) => setSmsTestRecipients(e.target.value)} placeholder="+15551234567, +15557654321" />
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Comma or newline separated. Leave blank to use an audience.</p>
                  </div>
                  <div>
                    <label htmlFor="sms-audience" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Audience</label>
                    <select
                      id="sms-audience"
                      value={smsAudience}
                      onChange={(e) => setSmsAudience(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="opt-in-marketing">Marketing opt-ins</option>
                      <option value="all-customers">All paid customers</option>
                      <option value="upcoming-attendees">Upcoming attendees</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sms-body" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Message</label>
                    <Textarea id="sms-body" rows={4} value={smsSendBody} onChange={(e) => setSmsSendBody(e.target.value)} placeholder="Type your SMS message…" />
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{smsSegmentCount(smsSendBody)} segment(s) · {smsSendBody.length} chars</p>
                  </div>
                  <Button onClick={handleSendSms} disabled={smsSending}>
                    {smsSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send SMS
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recent messages */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
              </CardHeader>
              <CardContent>
                {smsData?.recentMessages.length ? (
                  <div className="space-y-2">
                    {smsData.recentMessages.slice(0, 10).map((msg) => (
                      <div key={msg.id} className="flex items-start justify-between gap-2 rounded-lg border p-2 text-sm" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="min-w-0">
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{msg.recipientPhone}</p>
                          <p className="truncate" style={{ color: 'var(--text-muted)' }}>{msg.bodySnapshot}</p>
                        </div>
                        <Badge variant={smsStatusVariant[msg.status]}>{msg.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No messages sent yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && (
        <div role="tabpanel" id="tabpanel-delivery" aria-labelledby="tab-delivery" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-7">
            <CardHeader>
              <CardTitle>Delivery Worker Readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deliverabilityChecks.map((check) => (
                  <div key={check.label} className="flex items-start gap-3 rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                    {check.ready ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    ) : (
                      <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{check.label}</p>
                        <Badge variant={check.ready ? 'success' : 'warning'}>{check.ready ? 'ready' : 'needs setup'}</Badge>
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="col-span-12 space-y-6 xl:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Worker Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <PreferenceRow label="Approved" value={String(approvedCampaigns.length)} detail="Ready for server worker pickup" />
                  <PreferenceRow label="Awaiting approval" value={String(queuedCampaigns.length)} detail="Queued, scheduled, or draft campaigns" />
                  <PreferenceRow label="Suppression blocks" value={String(suppressionList.length)} detail="Addresses the worker should skip" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Production Function</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>`supabase/functions/email-worker/index.ts` now contains a dry-run worker scaffold.</p>
                  <p>It is designed to load approved campaigns, apply suppression and preference checks, and dispatch through a provider adapter.</p>
                  <p>It should run on a schedule or be invoked after campaign approval once provider secrets are configured.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div role="tabpanel" id="tabpanel-performance" aria-labelledby="tab-performance" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-8">
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {data.campaigns.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Recipients</th>
                        <th className="px-4 py-3">Open</th>
                        <th className="px-4 py-3">Click</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                      {data.campaigns.map((campaign) => (
                        <tr key={campaign.id}>
                          <td className="px-4 py-4">
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{campaign.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{campaign.subject}</p>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={campaign.status === 'sent' ? 'success' : campaign.status === 'cancelled' ? 'danger' : campaign.status === 'approved' ? 'primary' : 'gray'}>
                              {campaign.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{campaign.recipientCount}</td>
                          <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{campaign.openRate}%</td>
                          <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{campaign.clickRate}%</td>
                          <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(campaign.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
                  <TrendingUp className="mx-auto h-8 w-8" style={{ color: 'var(--primary-color)' }} />
                  <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>No campaign performance yet</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Once campaigns are queued or sent, opens, clicks, and provider events will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-12 space-y-6 xl:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preference Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <PreferenceRow label="Marketing opt-outs" value={String(data.performance.unsubscribes30d)} detail="Newsletter records marked inactive" />
                  <PreferenceRow label="Suppressed addresses" value={String(suppressionList.length)} detail="Manual, bounce, complaint, and unsubscribe blocks" />
                  <PreferenceRow label="Owner-approved sends" value={String(data.campaigns.filter((campaign) => ['approved', 'sent'].includes(campaign.status)).length)} detail="Campaigns cleared for backend delivery" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhook Events Needed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>Delivery confirmation from provider message IDs.</p>
                  <p>Bounce and complaint events copied into suppression records.</p>
                  <p>Open and click events joined back to campaign and customer profiles.</p>
                  <p>Unsubscribe links that update customer preferences immediately.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings" className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 xl:col-span-7">
            <CardHeader>
              <CardTitle>Email Provider Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="settings-provider" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Provider</label>
                  <select
                    id="settings-provider"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="resend">Resend</option>
                    <option value="postmark">Postmark</option>
                    <option value="sendgrid">SendGrid</option>
                    <option value="customerio">Customer.io</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="settings-domain" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sending domain</label>
                  <Input id="settings-domain" value={sendingDomain} onChange={(event) => setSendingDomain(event.target.value)} placeholder="paintandsip.com" />
                </div>
                <div>
                  <label htmlFor="settings-from-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>From name</label>
                  <Input id="settings-from-name" value={fromName} onChange={(event) => setFromName(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="settings-from-email" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>From email</label>
                  <Input id="settings-from-email" type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="settings-reply-to" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Reply-to email</label>
                  <Input id="settings-reply-to" type="email" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
                <input
                  type="checkbox"
                  checked={ownerApprovalRequired}
                  onChange={(event) => setOwnerApprovalRequired(event.target.checked)}
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Require owner approval for marketing sends</span>
                  <span className="mt-1 block text-sm" style={{ color: 'var(--text-muted)' }}>Transactional emails can run automatically. Campaigns, winbacks, gift card nudges, and segment sends should stay queued until an owner confirms.</span>
                </span>
              </label>

              <Button onClick={handleSaveSettings}>
                <Save className="mr-2 h-4 w-4" />
                Save Email Settings
              </Button>
            </CardContent>
          </Card>

          <div className="col-span-12 space-y-6 xl:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suppression List</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <Input type="email" value={suppressionEmail} onChange={(event) => setSuppressionEmail(event.target.value)} placeholder="customer@example.com" />
                  <select
                    value={suppressionReason}
                    onChange={(event) => setSuppressionReason(event.target.value as SuppressionReason)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="manual">Manual</option>
                    <option value="unsubscribe">Unsubscribe</option>
                    <option value="bounce">Bounce</option>
                    <option value="complaint">Complaint</option>
                  </select>
                </div>
                <Textarea value={suppressionNotes} onChange={(event) => setSuppressionNotes(event.target.value)} rows={2} placeholder="Optional note" />
                <Button variant="outline" onClick={() => void handleAddSuppression()} className="w-full" disabled={suppressing}>
                  <UserMinus className="mr-2 h-4 w-4" />
                  {suppressing ? 'Suppressing...' : 'Suppress Email'}
                </Button>
                <Input
                  placeholder="Search suppressed emails..."
                  value={filterSuppressions}
                  onChange={(e) => setFilterSuppressions(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {(() => {
                    const filtered = suppressionList.filter((entry) =>
                      entry.email.toLowerCase().includes(filterSuppressions.toLowerCase())
                    );
                    if (!suppressionList.length) {
                      return (
                        <p className="rounded-lg border border-dashed p-4 text-center text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                          No suppressed emails yet.
                        </p>
                      );
                    }
                    if (!filtered.length) {
                      return (
                        <p className="rounded-lg border border-dashed p-4 text-center text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                          No emails match your search.
                        </p>
                      );
                    }
                    const supPageCount = Math.ceil(filtered.length / PAGE_SIZE);
                    const safeSupPage = Math.min(suppressionPage, Math.max(supPageCount, 1));
                    const pagedSuppressions = filtered.slice((safeSupPage - 1) * PAGE_SIZE, safeSupPage * PAGE_SIZE);
                    return (
                      <>
                      {pagedSuppressions.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.email}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.reason}{entry.notes ? ` · ${entry.notes}` : ''}</p>
                        </div>
                        <button aria-label="Remove suppression" onClick={() => handleRemoveSuppression(entry.id)} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                        <Pagination
                          currentPage={safeSupPage}
                          totalPages={supPageCount}
                          totalItems={filtered.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setSuppressionPage}
                        />
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Production Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Safeguard icon={Globe2} title="Domain authentication" detail="Verify SPF, DKIM, and DMARC before sending from the studio domain." status="needed" />
                  <Safeguard icon={KeyRound} title="Server-only API key" detail="Store provider keys in Supabase functions or a backend worker, never in Vite env." status="needed" />
                  <Safeguard icon={ListMinus} title="Suppression list" detail="Block unsubscribed, bounced, complained, and manually suppressed addresses." status="needed" />
                  <Safeguard icon={FileCheck2} title="Audit trail" detail="Log who approved a send, what segment was used, and the exact template version." status="ready" />
                  <Safeguard icon={Lock} title="Consent split" detail="Keep transactional and marketing permissions separate on customer profiles." status="needed" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Behavior</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>Campaign drafts queue into `email_broadcasts` for review.</p>
                  <p>Actual delivery should happen in a server worker after suppression and consent checks pass.</p>
                  <p>Settings on this screen are stored locally until the `email_settings` or `settings.email_provider` backend key is added.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>

    <ConfirmDialog
      isOpen={deleteConfirmTemplate !== null}
      onClose={() => setDeleteConfirmTemplate(null)}
      onConfirm={() => void handleDeleteTemplate()}
      title="Delete template?"
      message={`Are you sure you want to delete "${deleteConfirmTemplate?.name || 'this template'}"? This cannot be undone.`}
      confirmLabel="Delete"
      icon="trash"
    />

    <ConfirmDialog
      isOpen={deleteConfirmSmsTemplate !== null}
      onClose={() => setDeleteConfirmSmsTemplate(null)}
      onConfirm={() => void handleDeleteSmsTemplate()}
      title="Delete SMS template?"
      message={`Are you sure you want to delete "${deleteConfirmSmsTemplate?.name || 'this template'}"? This cannot be undone.`}
      confirmLabel="Delete"
      icon="trash"
    />

    <ConfirmDialog
      isOpen={deleteConfirmSegment !== null}
      onClose={() => setDeleteConfirmSegment(null)}
      onConfirm={confirmDeleteSegment}
      title="Delete segment?"
      message="Are you sure you want to delete this custom segment? This cannot be undone."
      confirmLabel="Delete"
      icon="trash"
    />

    <ConfirmDialog
      isOpen={cancelConfirmCampaign !== null}
      onClose={() => setCancelConfirmCampaign(null)}
      onConfirm={async () => {
        const id = cancelConfirmCampaign;
        setCancelConfirmCampaign(null);
        if (!id) return;
        try {
          await updateCampaignStatus.mutateAsync({ id, status: 'cancelled' });
          showToast('Campaign cancelled');
        } catch (error) {
          showToast(`Failed to cancel campaign: ${getErrorMessage(error)}`);
        }
      }}
      title="Cancel campaign?"
      message="Are you sure you want to cancel this campaign? Cancelled campaigns cannot be sent."
      confirmLabel="Cancel Campaign"
      icon="warning"
      variant="warning"
    />
    </>
    </FeatureGate>
  );
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    resend: 'Resend',
    postmark: 'Postmark',
    sendgrid: 'SendGrid',
    customerio: 'Customer.io',
  };
  return labels[provider] || provider;
}

function Safeguard({ icon: Icon, title, detail, status }: { icon: LucideIcon; title: string; detail: string; status: 'ready' | 'needed' }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: status === 'ready' ? '#16a34a' : 'var(--primary-color)' }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <Badge variant={status === 'ready' ? 'success' : 'warning'}>{status}</Badge>
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      </div>
    </div>
  );
}

function PreferenceRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--primary-color)' }}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      </CardContent>
    </Card>
  );
}
