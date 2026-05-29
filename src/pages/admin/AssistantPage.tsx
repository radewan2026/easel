import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle2, Gift, History, Mail, MessageSquare, Plus, Send, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useDashboardStats, useSettings, useUpdateSetting } from '../../hooks/useAdmin';
import { useOwnerActionFeed } from '../../hooks/useOwnerActionFeed';
import { usePrivateEventRequests } from '../../hooks/usePrivateEventRequests';
import { useEvents } from '../../hooks/useEvents';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { logActivity } from '../../lib/activityLog';
import { callAiGateway } from '../../lib/aiGateway';
import type { Event, PrivateEventRequest, Setting } from '../../types/database';

type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type AssistantThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AssistantMessage[];
};

const STORAGE_KEY = 'ask_easel_threads';
const AUDIT_KEY = 'ask_easel_audit';

type AssistantAuditItem = {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
};

function isAssistantThreadArray(value: unknown): value is AssistantThread[] {
  return Array.isArray(value) && value.every((thread) => (
    typeof thread === 'object' &&
    thread !== null &&
    'id' in thread &&
    'messages' in thread &&
    Array.isArray((thread as { messages?: unknown }).messages)
  ));
}

const starterPrompts = [
  'What needs attention today?',
  'Draft a campaign for low-fill events',
  'Prepare a private event follow-up',
  'Summarize sales and seats this month',
  'Create a draft coupon plan',
  'What should I do before this weekend?',
];

function loadThreads(): AssistantThread[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAudit(): AssistantAuditItem[] {
  try {
    const stored = localStorage.getItem(AUDIT_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createThread(): AssistantThread {
  const now = new Date().toISOString();
  return {
    id: `thread-${Date.now()}`,
    title: 'New Ask Easel thread',
    updatedAt: now,
    messages: [
      {
        id: `message-${Date.now()}`,
        role: 'assistant',
        createdAt: now,
        content: 'I can help you review priorities, draft campaigns, prep private-event replies, and point you to the right workflow. I will draft or navigate, but I will not send, publish, charge, delete, or approve anything without you taking the final action.',
      },
    ],
  };
}

export default function AssistantPage() {
  const navigate = useNavigate();
  const { openAssistant } = useOutletContext<{ openAssistant?: () => void }>();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();
  const { data: stats } = useDashboardStats('30d');
  const ownerActions = useOwnerActionFeed();
  const { data: privateRequests = [] } = usePrivateEventRequests();
  const { data: events = [] } = useEvents();
  const [threads, setThreads] = useState<AssistantThread[]>(() => {
    const saved = loadThreads();
    return saved.length ? saved : [createThread()];
  });
  const [activeThreadId, setActiveThreadId] = useState(() => threads[0]?.id || '');
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [hasLoadedRemoteThreads, setHasLoadedRemoteThreads] = useState(false);
  const [audit, setAudit] = useState<AssistantAuditItem[]>(loadAudit);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const shouldUseRemoteMemory = Boolean(user?.id && user.id !== 'local-demo-admin');
  const assistantSettingsKey = `ask_easel_threads_${user?.id || 'local'}`;
  const urgentActions = ownerActions.filter((item) => item.urgent).slice(0, 5);
  const lowFillEvents = events
    .filter((event: Event) => {
      const max = Number(event.max_seats || 0);
      const available = Number(event.seats_available ?? max);
      return max > 0 && (max - available) / max < 0.35 && new Date(event.start_datetime).getTime() > Date.now();
    })
    .slice(0, 5);
  const submittedRequests = privateRequests.filter((request: PrivateEventRequest) => request.status === 'submitted').slice(0, 5);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    if (shouldUseRemoteMemory && hasLoadedRemoteThreads) {
      updateSetting.mutate({ key: assistantSettingsKey, value: JSON.stringify(threads) });
    }
  // updateSetting is intentionally omitted to avoid saving loops from mutation identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, shouldUseRemoteMemory, assistantSettingsKey, hasLoadedRemoteThreads]);

  useEffect(() => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(0, 25)));
  }, [audit]);

  useEffect(() => {
    if (!shouldUseRemoteMemory || !settings || hasLoadedRemoteThreads) {
      if (!shouldUseRemoteMemory) setHasLoadedRemoteThreads(true);
      return;
    }
    const remote = (settings as Setting[]).find((setting) => setting.key === assistantSettingsKey)?.value;
    if (typeof remote === 'string') {
      try {
        const parsed = JSON.parse(remote);
        if (isAssistantThreadArray(parsed) && parsed.length > 0) {
          setThreads(parsed);
          setActiveThreadId(parsed[0].id);
        }
      } catch (error) {
        console.debug('Failed to parse Ask Easel remote threads', error);
      }
    }
    setHasLoadedRemoteThreads(true);
  }, [settings, assistantSettingsKey, hasLoadedRemoteThreads, shouldUseRemoteMemory]);

  const recordAudit = (action: string, detail: string) => {
    const item = { id: `audit-${Date.now()}`, action, detail, timestamp: new Date().toISOString() };
    setAudit((current) => [item, ...current].slice(0, 25));
    logActivity({
      action: 'settings.updated',
      entityType: 'settings',
      entityName: detail.slice(0, 80),
      details: { assistantAction: action, detail },
    });
  };

  const callAi = async (prompt: string, mode: 'answer' | 'draft') => {
    const result = await callAiGateway({
      task: 'admin_assistant',
      maxTokens: mode === 'draft' ? 700 : 450,
      messages: [
        {
          role: 'system',
          content: `You are Ask Easel, an owner assistant for a paint-and-sip studio admin. Be concise, practical, and do not use emojis. Never claim to send, publish, charge, delete, approve, or modify records. You can draft text and recommend where the owner should review it. Current context: ${contextSummary.urgentCount} urgent actions, ${contextSummary.privateLeads} submitted private leads, ${contextSummary.lowFillCount} low-fill events, ${contextSummary.revenue} revenue, ${contextSummary.seats} seats sold, ${contextSummary.giftCards} gift card liability. Mode: ${mode}.`,
        },
        ...activeThread.messages.slice(-8).map((message) => ({ role: message.role, content: message.content })),
        { role: 'user', content: prompt },
      ],
    });

    if (!result.content) {
      recordAudit('ai_fallback', result.source === 'unconfigured' ? 'AI gateway not configured; used local assistant logic' : `${result.error}; used local assistant logic`);
      return null;
    }
    return result.content;
  };

  const contextSummary = useMemo(() => {
    const revenue = formatCurrency(stats?.revenue?.value || 0);
    const seats = stats?.seatsSold?.value || 0;
    const giftCards = formatCurrency(stats?.giftCardLiability || 0);
    return {
      revenue,
      seats,
      giftCards,
      urgentCount: urgentActions.length,
      privateLeads: submittedRequests.length,
      lowFillCount: lowFillEvents.length,
    };
  }, [stats, urgentActions.length, submittedRequests.length, lowFillEvents.length]);

  const buildResponse = async (prompt: string) => {
    const lower = prompt.toLowerCase();
    if (lower.includes('campaign') || lower.includes('low-fill') || lower.includes('promote')) {
      const aiDraft = await callAi(prompt, 'draft');
      const eventList = lowFillEvents.length
        ? lowFillEvents.map((event) => {
          const maxSeats = event.max_seats || 0;
          const availableSeats = event.seats_available ?? maxSeats;
          return `- ${event.title}: ${maxSeats - availableSeats} / ${maxSeats} seats sold`;
        }).join('\n')
        : '- No low-fill events are currently visible in the upcoming event list.';
      setDraft(aiDraft || `Subject: A creative night out is waiting\n\nHi {{first_name}},\n\nWe still have seats open for a few upcoming paint-and-sip events. If you have been meaning to plan a night out, this is a great week to join us.\n\nFeatured events:\n${eventList}\n\nReserve your seats here: {{booking_link}}\n\nSee you in the studio,\nEasel Paint & Sip`);
      recordAudit('draft_created', 'Low-fill event campaign draft prepared');
      return `I prepared a low-fill event campaign draft in the Draft panel. Review the copy, then use Email Center when you are ready to send.\n\nEvents I considered:\n${eventList}`;
    }

    if (lower.includes('private') || lower.includes('follow')) {
      const aiDraft = await callAi(prompt, 'draft');
      const lead = submittedRequests[0];
      setDraft(aiDraft || `Hi ${lead?.contact_name || '{{contact_name}}'},\n\nThanks for reaching out about a private paint-and-sip event. We would love to help shape this for your group.\n\nA few helpful details:\n- Preferred date and backup date\n- Approximate guest count\n- Location preference\n- Budget range\n- Any theme, occasion, or accessibility needs\n\nOnce I have those details, I can recommend the best package and next steps.\n\nBest,\nEasel Paint & Sip`);
      recordAudit('draft_created', 'Private event follow-up draft prepared');
      return `I drafted a private-event follow-up in the Draft panel. ${lead ? `The newest submitted lead is ${lead.contact_name} for ${lead.guest_count} guests.` : 'There are no submitted leads right now, so I used a reusable template.'}`;
    }

    if (lower.includes('coupon')) {
      const aiDraft = await callAi(prompt, 'draft');
      setDraft(aiDraft || `Draft coupon plan\n\nName: Weeknight Studio Boost\nCode: PAINTNIGHT10\nDiscount: 10% off public events\nEligibility: Monday through Thursday events only\nSuggested limit: 50 uses\nSuggested expiration: 14 days from launch\nOwner check before launch: confirm margin, exclude private events, and test checkout.`);
      recordAudit('draft_created', 'Coupon plan draft prepared');
      return 'I prepared a coupon plan in the Draft panel. It is not created or published yet. Use Coupons when you want to configure and activate it.';
    }

    if (lower.includes('sales') || lower.includes('revenue') || lower.includes('seats')) {
      const aiAnswer = await callAi(prompt, 'answer');
      if (aiAnswer) return aiAnswer;
      return `For the last 30 days, the dashboard shows ${contextSummary.revenue} in revenue and ${contextSummary.seats} seats sold. Gift card liability is currently ${contextSummary.giftCards}. I would review low-fill events next if revenue is below target, then check gift-card holders for a redemption campaign.`;
    }

    if (lower.includes('weekend') || lower.includes('attention') || lower.includes('today') || lower.includes('next')) {
      const aiAnswer = await callAi(prompt, 'answer');
      if (aiAnswer) return aiAnswer;
      const actions = urgentActions.length
        ? urgentActions.map((item, index) => `${index + 1}. ${item.summary} - ${item.actionLabel}`).join('\n')
        : 'No urgent action feed items are showing right now.';
      return `Here is what I would handle first:\n\n${actions}\n\nAfter that, check private requests (${contextSummary.privateLeads} submitted) and review the upcoming event fill table.`;
    }

    const aiAnswer = await callAi(prompt, 'answer');
    return aiAnswer || `Here is the current operating picture: ${contextSummary.urgentCount} urgent actions, ${contextSummary.privateLeads} submitted private leads, ${contextSummary.lowFillCount} low-fill upcoming events, ${contextSummary.revenue} revenue, and ${contextSummary.seats} seats sold in the selected 30-day view. Ask me to draft a campaign, prep a private-event reply, summarize sales, or create a coupon plan.`;
  };

  const saveMessage = async (prompt: string) => {
    if (!activeThread) return;
    const now = new Date().toISOString();
    setIsThinking(true);
    recordAudit('prompt_submitted', prompt.slice(0, 120));
    try {
      const response = await buildResponse(prompt);
      setThreads((current) => current.map((thread) => {
        if (thread.id !== activeThread.id) return thread;
        const title = thread.title === 'New Ask Easel thread' ? prompt.slice(0, 42) : thread.title;
        return {
          ...thread,
          title,
          updatedAt: now,
          messages: [
            ...thread.messages,
            { id: `message-${Date.now()}-user`, role: 'user', content: prompt, createdAt: now },
            { id: `message-${Date.now()}-assistant`, role: 'assistant', content: response, createdAt: now },
          ],
        };
      }));
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    saveMessage(input.trim());
    setInput('');
  };

  const startNewThread = () => {
    const thread = createThread();
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setDraft('');
    recordAudit('thread_created', 'New Ask Easel thread started');
  };

  const navigateWithAudit = (to: string, detail: string) => {
    recordAudit('handoff_opened', detail);
    navigate(to);
  };

  const actionCards = [
    { label: 'Review urgent actions', value: contextSummary.urgentCount, icon: CheckCircle2, to: '/admin' },
    { label: 'Private leads', value: contextSummary.privateLeads, icon: Mail, to: '/admin/private-requests' },
    { label: 'Low-fill events', value: contextSummary.lowFillCount, icon: Calendar, to: '/admin/events' },
    { label: 'Gift card liability', value: contextSummary.giftCards, icon: Gift, to: '/admin/gift-cards' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--primary-color)' }}>Ask Easel</p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Owner assistant workspace</h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>Analyze the studio, draft the next move, and jump into the right workflow. Drafts stay here until you choose where to use them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={openAssistant}><Sparkles className="mr-2 h-4 w-4" /> Open drawer</Button>
          <Button onClick={startNewThread}><Plus className="mr-2 h-4 w-4" /> New thread</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.to} className="rounded-xl border p-4 transition hover:opacity-90" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="mt-4 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{card.value}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="rounded-xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border-color)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Saved threads</h2>
          </div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className="w-full rounded-lg p-3 text-left transition hover:opacity-90"
                style={{ backgroundColor: activeThread?.id === thread.id ? 'var(--admin-input-bg)' : 'transparent', color: 'var(--text-primary)' }}
              >
                <p className="truncate text-sm font-semibold">{thread.title}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(thread.updatedAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[640px] flex-col rounded-xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border-color)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{activeThread?.title || 'Ask Easel'}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button key={prompt} onClick={() => saveMessage(prompt)} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--admin-input-bg)', color: 'var(--text-secondary)' }}>{prompt}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {activeThread?.messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[78%] rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap" style={{
                  backgroundColor: message.role === 'user' ? 'var(--primary-color)' : 'var(--admin-input-bg)',
                  borderColor: message.role === 'user' ? 'var(--primary-color)' : 'var(--border-color)',
                  color: message.role === 'user' ? 'white' : 'var(--text-primary)',
                }}>
                  {message.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="rounded-2xl border px-4 py-3 text-sm" style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  Thinking through the safest next step...
                </div>
              </div>
            )}
          </div>
          <div className="border-t p-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSend();
                }}
                placeholder="Ask about actions, campaigns, private leads, sales..."
                className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
	              <Button onClick={handleSend} disabled={isThinking}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Draft panel</h2>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Campaign copy, private-event replies, and coupon plans will appear here."
              className="mt-4 min-h-[280px] w-full rounded-xl border p-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" disabled={!draft.trim()} onClick={() => navigateWithAudit('/admin/email', 'Draft handed off to Email Center')}>Use in Email Center</Button>
              <Button variant="secondary" disabled={!draft.trim()} onClick={() => navigateWithAudit('/admin/private-requests', 'Draft handed off to Private Requests')}>Use for Private Requests</Button>
              <Button variant="secondary" disabled={!draft.trim()} onClick={() => navigateWithAudit('/admin/coupons', 'Draft handed off to Coupons')}>Configure Coupon</Button>
            </div>
          </section>

          <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Assistant history</h2>
            </div>
            <div className="mt-3 space-y-3">
              {audit.length ? audit.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--admin-input-bg)' }}>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.action.replaceAll('_', ' ')}</p>
                  <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              )) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Prompts, drafts, and handoffs will appear here.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Safety rules</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>Drafts are not sent automatically.</li>
              <li>Coupons are not activated from chat.</li>
              <li>Events are not published from chat.</li>
              <li>Payments, deletions, and approvals stay manual.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
