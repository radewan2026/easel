import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, HelpCircle, Sparkles, RotateCcw, Mic, MicOff, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { useSettings } from '../../hooks/useAdmin';
import { useOwnerActionFeed } from '../../hooks/useOwnerActionFeed';
import { callAiGateway } from '../../lib/aiGateway';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isNew?: boolean;
}

const adminHelpContent = {
  'getting started': `Welcome to the Admin! Here's how to get started:

• Dashboard - Overview of your business with key metrics
• Events - Create and manage your painting events
• Venues - Add locations where events are held
• Coupons - Create discount codes for customers
• Sales - View all orders and transactions
• Blog - Write content to attract visitors
• Settings - Configure your site details
• Accounts - Manage staff access`,

  'events': `Managing Events:

• Create Event: Go to Events → Click "Add Event" button
• Required Fields: Title, Date/Time, Price per seat
• Optional: Description, Venue, Max seats, Image
• Publishing: Toggle "Published" to show on site
• Sorting: Click column headers to sort the list
• Edit: Click the pencil icon to modify an event
• Delete: Click the trash icon`,

  'venues': `Managing Venues:

• Add Venue: Go to Venues → Click "Add Venue"
• Fields: Name (required), Address, City, State, Phone, Capacity
• Status: Toggle "Active" to show/hide from dropdowns`,

  'coupons': `Creating Coupons:

• Manual Coupon: Go to Coupons → Add Coupon
• Code: The code customers enter at checkout
• Discount Type: Percentage or Fixed amount
• Usage Limits: Set max uses to limit redemptions
• Dates: Optional validity period`,

  'sales': `Viewing Sales:

• All Orders: See all purchases in the Sales section
• Filters: Filter by event or order status
• Click any order to see full details
• Update order status (Pending → Paid → Cancelled → Refunded)`,

  'blog': `Managing Blog Posts:

• Create Post: Go to Blog → Create new post
• Required: Title and content
• SEO: Add meta title, description for search engines
• Publishing: Toggle to publish/unpublish posts`,

  'settings': `Settings Tabs:

• General: Site name, description, contact email
• Social: Facebook, Instagram, Twitter links
• Appearance: Site color customization`,

  'accounts': `Managing Staff Accounts:

• Add Account: Create login for staff/manager/admin
• Roles:
  - Admin: Full access
  - Manager: Can manage events, sales, blog
  - Staff: View-only access`,
};

interface PendingEvent {
  title?: string;
  date?: string;
  time?: string;
  price?: number;
  venue_id?: string;
  max_seats?: number;
}

type SpeechRecognitionResultLike = {
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getNextEventDate(dayName?: string, time?: string) {
  const eventDate = new Date();
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = dayName ? dayMap[dayName.toLowerCase()] : undefined;

  if (targetDay !== undefined) {
    const currentDay = eventDate.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    eventDate.setDate(eventDate.getDate() + daysUntil);
  }

  if (time) {
    const [hour, min] = time.split(':').map(Number);
    eventDate.setHours(hour || 19, min || 0, 0, 0);
  } else {
    eventDate.setHours(19, 0, 0, 0);
  }

  return eventDate;
}

function toDraftEventState(eventData: PendingEvent) {
  const eventDate = getNextEventDate(eventData.date, eventData.time);
  return {
    assistantDraftEvent: {
      title: eventData.title,
      start_datetime: eventDate.toISOString(),
      base_price_per_seat: eventData.price,
      max_seats: eventData.max_seats || 20,
      description: eventData.title
        ? `Join us for a fun painting event - ${eventData.title}! No experience necessary. All supplies provided.`
        : '',
    },
  };
}

type PageContext = {
  key: string;
  label: string;
  summary: string;
  prompts: string[];
};

function getPageContext(pathname: string): PageContext {
  if (pathname === '/admin') return {
    key: 'dashboard',
    label: 'Dashboard',
    summary: 'The owner briefing page with priority cards, next best actions, recent activity, and performance snapshot.',
    prompts: ['What needs attention today?', 'Which events need staff?', 'Show me private requests'],
  };
  if (pathname.startsWith('/admin/events')) return {
    key: 'events',
    label: 'Events',
    summary: 'The event health board with fill rate, staffing, venue, publication status, and next actions.',
    prompts: ['Which events need promotion?', 'Which events need staff?', 'Help me create an event'],
  };
  if (pathname.startsWith('/admin/private-requests')) return {
    key: 'private_requests',
    label: 'Private Requests',
    summary: 'The private event CRM pipeline for submitted, contacted, confirmed, converted, and declined leads.',
    prompts: ['Draft a private request reply', 'What leads need follow-up?', 'How do I convert a request?'],
  };
  if (pathname.startsWith('/admin/customers')) return {
    key: 'customers',
    label: 'Customers',
    summary: 'The customer CRM with saved segments, lifetime value, roles, interactions, and export tools.',
    prompts: ['Show high-value customers', 'What segments should I market to?', 'Export a segment'],
  };
  if (pathname.startsWith('/admin/marketing')) return {
    key: 'marketing',
    label: 'Marketing Center',
    summary: 'Campaign ideas and outreach tools for low-fill events, lapsed customers, gift-card holders, referrals, and testimonials.',
    prompts: ['Suggest a campaign', 'Promote low-fill events', 'Draft a lapsed customer email'],
  };
  if (pathname.startsWith('/admin/pay-queue') || pathname.startsWith('/admin/payroll')) return {
    key: 'payroll',
    label: 'Payroll',
    summary: 'Payroll review, approval, payment queue, failed payments, and paid history.',
    prompts: ['What pay records need review?', 'Explain payroll statuses', 'What failed payments need retry?'],
  };
  if (pathname.startsWith('/admin/memberships')) return {
    key: 'memberships',
    label: 'Memberships',
    summary: 'Subscription membership dashboard with active plans, credit redemptions, outstanding credits, and credit liability.',
    prompts: ['Which members need attention?', 'Explain credit liability', 'How should checkout credits work?'],
  };
  if (pathname.startsWith('/admin/activity-log')) return {
    key: 'activity',
    label: 'Activity Log',
    summary: 'Audit trail plus owner action feed for operational visibility.',
    prompts: ['What recently changed?', 'What actions need attention?', 'Export activity'],
  };
  if (pathname.startsWith('/admin/settings')) return {
    key: 'settings',
    label: 'Settings',
    summary: 'Site settings, appearance, persona, API, email, and payment setup.',
    prompts: ['What setup is missing?', 'Where do I configure payments?', 'Where is the AI key?'],
  };
  return {
    key: 'admin',
    label: 'Admin',
    summary: 'The Easel admin system for events, sales, customers, marketing, staff, payroll, content, and settings.',
    prompts: ['What can I do here?', 'Where should I go next?', 'What needs attention?'],
  };
}

export function AdminChatBot({ isOpen: propIsOpen, onToggle, navigate: propNavigate, pathname = '/admin' }: { isOpen?: boolean; onToggle?: () => void; navigate?: ReturnType<typeof useNavigate>; pathname?: string }) {
  const routerNavigate = useNavigate();
  const isControlled = propIsOpen !== undefined;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isControlled ? propIsOpen : internalIsOpen;
  const setIsOpen = (value: boolean) => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalIsOpen(value);
    }
  };
  const navigate = propNavigate || routerNavigate;
  const { data: settings } = useSettings();
  const ownerActionFeed = useOwnerActionFeed();
  const pageContext = getPageContext(pathname);
  
  const siteSettings = settings?.find((s) => s.key === 'siteSettings')?.value as Record<string, unknown> | undefined;
  const brandName = (siteSettings?.brandName as string) || '';
  
  const getGreeting = () => {
    if (brandName) {
      return `Welcome to the admin dashboard. From this area you can manage your entire online system. Feel free to ask me how to do anything in the system and I'll do my best to help you along the way.`;
    }
    return "Welcome to the admin dashboard. From this area you can manage your entire online system. Feel free to ask me how to do anything in the system and I'll do my best to help you along the way.";
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: getGreeting(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<PendingEvent | null>(null);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgIdRef = useRef(0);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const speechWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setInput(transcript);
      
      if (listenTimeoutRef.current) clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = setTimeout(() => {
        if (isListening) {
          stopListening();
        }
      }, 7000);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (listenTimeoutRef.current) {
        clearTimeout(listenTimeoutRef.current);
        listenTimeoutRef.current = null;
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isListening, stopListening, setInput]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const summarizeOwnerActions = () => {
    const top = ownerActionFeed.slice(0, 5);
    if (top.length === 0) return 'No urgent owner actions are currently showing in the feed.';
    return top.map((item, index) => `${index + 1}. ${item.summary}\n   ${item.detail}\n   Action: ${item.actionLabel}`).join('\n');
  };

  const shouldHandleLocally = (query: string) => {
    const normalized = query.toLowerCase();
    return (
      (normalized.includes('create') && normalized.includes('event')) ||
      normalized.includes('need staff') ||
      normalized.includes('missing staff') ||
      (normalized.includes('private') && (normalized.includes('follow') || normalized.includes('lead') || normalized.includes('request'))) ||
      normalized.includes('what needs attention') ||
      normalized.includes('next action') ||
      normalized.includes('next best') ||
      normalized.includes('where am i') ||
      normalized.includes('this page')
    );
  };

  const findRelevantContent = async (query: string): Promise<string> => {
  const lowerQuery = query.toLowerCase();
    const keywords: Record<string, string[]> = {
      'getting started': ['start', 'begin', 'hello', 'help', 'how do i', 'getting started', 'overview', 'what can i do'],
      'create event': ['create event', 'new event', 'add event', 'make an event', 'book event', 'create an event'],
      'events': ['events', 'event', 'class', 'painting', 'edit event'],
      'venues': ['venue', 'location', 'address', 'where', 'place'],
      'coupons': ['coupon', 'discount', 'promo', 'code', 'groupon'],
      'sales': ['sale', 'order', 'purchase', 'transaction', 'revenue', 'money'],
      'blog': ['blog', 'post', 'article', 'news', 'content', 'write'],
      'settings': ['settings', 'config', 'configure', 'site name', 'email'],
      'accounts': ['account', 'user', 'staff', 'login', 'permission'],
      'site stats': ['traffic', 'stats', 'site', 'revenue', 'sales', 'seats', 'upcoming', 'how is', "how's"],
      'owner actions': ['what needs attention', 'next action', 'next best', 'urgent', 'action feed', 'today'],
      'page context': ['this page', 'where am i', 'what can i do here', 'explain this page'],
    };

    if (keywords['page context'].some(p => lowerQuery.includes(p))) {
      return `${pageContext.label}\n\n${pageContext.summary}\n\nUseful questions here:\n${pageContext.prompts.map(prompt => `• ${prompt}`).join('\n')}`;
    }

    if (keywords['owner actions'].some(p => lowerQuery.includes(p))) {
      return `Here are the top owner actions I see:\n\n${summarizeOwnerActions()}`;
    }

    if (lowerQuery.includes('need staff') || lowerQuery.includes('missing staff')) {
      navigate('/admin/events');
      return 'Opening the Events health board. Use the Missing Staff saved view, or click Assign staff from any event row to jump straight into the assignment action.';
    }

    if (lowerQuery.includes('private') && (lowerQuery.includes('follow') || lowerQuery.includes('lead') || lowerQuery.includes('request'))) {
      navigate('/admin/private-requests');
      return 'Opening the private event pipeline. Start with Submitted leads, then use Draft Reply, Mark Contacted, or Convert to Event from the request detail.';
    }

    if (lowerQuery.includes('campaign') || lowerQuery.includes('marketing')) {
      navigate('/admin/marketing');
      return 'Opening the Marketing Center. It groups campaign ideas, customer segments, email tools, coupons, referrals, testimonials, and outreach signals.';
    }

    const isCreateEvent = lowerQuery.includes('create') && lowerQuery.includes('event');
    if (isCreateEvent) {
      if (!pendingEvent) {
        const eventData: PendingEvent = {};
        
        const titleMatch = query.match(/called\s+(.+?)(?:\s+for|\s+on|\s+at|\s+\$)/i);
        if (titleMatch) {
          eventData.title = titleMatch[1].trim();
        } else {
          const titlePart = query
            .replace(/create\s+(?:a\s+)?new\s+event\s+(?:called\s+)?/gi, '')
            .replace(/\s+for\s+\w+\s+night/gi, '')
            .replace(/\s+for\s+\w+\s+at\s+\d+:\d+/gi, '')
            .replace(/\s+at\s+\d+:\d+\s*(?:am|pm)?/gi, '')
            .replace(/\s+for\s+\$\d+/gi, '')
            .trim();
          if (titlePart && titlePart.length > 2) eventData.title = titlePart;
        }
        
        const lowerQuery = query.toLowerCase();
        const dayAliases: Record<string, string> = {
          'sunday': 'sunday', 'monday': 'monday', 'tuesday': 'tuesday', 'wednesday': 'wednesday',
          'thursday': 'thursday', 'friday': 'friday', 'saturday': 'saturday',
          'fri night': 'friday', 'sat night': 'saturday', 'thurs night': 'thursday',
        };
        for (const [alias, day] of Object.entries(dayAliases)) {
          if (lowerQuery.includes(alias) || lowerQuery.includes(day)) {
            eventData.date = day;
            break;
          }
        }
        
        const colonMatch = query.match(/(\d{1,2}):(\d{2})/);
        const pmMatch = query.match(/(\d{1,2})\s*(p\.?m\.?)/i);
        const amMatch = query.match(/(\d{1,2})\s*(a\.?m\.?)/i);
        
        if (colonMatch) {
          let hour = parseInt(colonMatch[1]);
          const min = colonMatch[2];
          if (lowerQuery.includes('pm') && hour !== 12) hour += 12;
          if (lowerQuery.includes('am') && hour === 12) hour = 0;
          eventData.time = `${hour}:${min}`;
        } else if (pmMatch) {
          let hour = parseInt(pmMatch[1]);
          if (hour !== 12) hour += 12;
          eventData.time = `${hour}:00`;
        } else if (amMatch) {
          let hour = parseInt(amMatch[1]);
          if (hour === 12) hour = 0;
          eventData.time = `${hour}:00`;
        }
        
        const priceMatch = query.match(/\$(\d+)/);
        if (priceMatch) eventData.price = parseInt(priceMatch[1]);

        if (!eventData.date) {
          for (const [alias, day] of Object.entries(dayAliases)) {
            if (lowerQuery.includes(alias)) {
              eventData.date = day;
              break;
            }
          }
        }
        
        if (!eventData.time) {
          const pM = lowerQuery.match(/(\d+)\s*(p\.?m\.?)/i);
          if (pM) {
            let hour = parseInt(pM[1]);
            if (hour !== 12) hour += 12;
            eventData.time = `${hour}:00`;
          }
        }

        if (eventData.title && eventData.date && eventData.time && eventData.price) {
          navigate('/admin/events/new', { state: toDraftEventState(eventData) });
          setIsOpen(false);
          return `I prepared a draft for "${eventData.title}" and opened the event form. Review it there before saving or publishing.`;
        } else {
          setPendingEvent(eventData);
          const missing: string[] = [];
          if (!eventData.title) missing.push('title');
          if (!eventData.date) missing.push('date (e.g., this Thursday)');
          if (!eventData.time) missing.push('time (e.g., 7pm)');
          if (!eventData.price) missing.push('price (e.g., $40)');
          return `Got it! But I need: ${missing.join(', ')}. What's the ${missing[0]}?`;
        }
      }

const eventData: PendingEvent = { ...pendingEvent };
      const numberOnly = query.replace(/[^0-9]/g, '');
      if (numberOnly.length > 0 && !isNaN(Number(numberOnly))) {
        eventData.price = Number(numberOnly);
      }
      if (!eventData.date && query.length > 2) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'today', 'tomorrow'];
        for (const day of days) {
          if (lowerQuery.includes(day)) {
            eventData.date = day === 'sunday' ? 'sunday' : day;
            break;
          }
        }
      }
      if (!eventData.title && query.length > 2 && !numberOnly) {
        eventData.title = query.trim();
      }

      const missing: string[] = [];
      if (!eventData.title) missing.push('title');
      if (!eventData.date) missing.push('date');
      if (!eventData.time) missing.push('time');
      if (!eventData.price) missing.push('price');

      if (missing.length > 0) {
        setPendingEvent(eventData);
        return `What's the ${missing[0]}?`;
      }

      setPendingEvent(null);
      navigate('/admin/events/new', { state: toDraftEventState(eventData) });
      setIsOpen(false);
      return `I opened the event form with a draft. Review it before saving or publishing.`;
    }

    if (pendingEvent) {
      const isNewCreateRequest = keywords['create event'].some(p => lowerQuery.includes(p));
      if (!isNewCreateRequest) {
        if (lowerQuery.includes('cancel') || lowerQuery.includes('never mind') || lowerQuery.includes('stop')) {
          setPendingEvent(null);
          return "OK, cancelled. What else can I help you with?";
        }
      }
    }

    for (const [key, phrases] of Object.entries(keywords)) {
      if (phrases.some(p => lowerQuery.includes(p))) {
        if (key === 'site stats') {
          setIsTyping(true);
          try {
            return await getSiteStats();
          } catch {
            return "Sorry, I couldn't fetch the stats right now. Please try again.";
          } finally {
            setIsTyping(false);
          }
        }
        return adminHelpContent[key as keyof typeof adminHelpContent];
      }
    }

    return "I'm not sure about that. Try asking about:\n\n• Events, Venues, Coupons\n• Sales, Blog\n• Settings, Accounts\n• Getting Started\n• Site Stats (traffic, sales, events)";
  };

  const getSiteStats = useCallback(async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [orders, events, attendees, activityData] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', thirtyDaysAgo.toISOString()).eq('status', 'paid'),
      supabase.from('events').select('*').gte('start_datetime', now.toISOString()).eq('is_published', true),
      supabase.from('attendees').select('*').gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('activity_log').select('*').gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    const totalRevenue = orders.data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const totalSeats = orders.data?.reduce((sum, o) => sum + (o.total_seats || 0), 0) || 0;
    const upcomingEvents = events.data?.length || 0;
    const totalAttendees = attendees.data?.length || 0;
    const pageViews = activityData.data?.length || 0;

    return `📊 Site Stats (Last 30 Days)

💰 Revenue: $${totalRevenue.toLocaleString()}
🎟️ Seats Sold: ${totalSeats}
👥 Attendees Checked In: ${totalAttendees}
📅 Upcoming Events: ${upcomingEvents}
👁️ Page Views/Actions: ${pageViews}

Would you like more details on any of these?`;
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${msgIdRef.current++}`,
      role: 'user',
      content: input,
      isNew: true,
    };

    // Add to message history for arrow key navigation
    setMessageHistory(prev => [...prev, input.trim()]);
    setHistoryIndex(-1);

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      let response: string;

      if (shouldHandleLocally(input)) {
        response = await findRelevantContent(input);
      } else {
        setIsTyping(true);
        try {
          const systemMessage = brandName
            ? `You are an AI admin assistant for ${brandName}. The user is currently on ${pageContext.label}: ${pageContext.summary}. Top owner actions: ${summarizeOwnerActions()}. Help with events, venues, orders, customers, marketing, payroll, settings, analytics, and system tasks. Be helpful, clear, concise, and do not use emojis. Suggest actions but do not claim to complete sends/payments/deletes unless the user explicitly performs them.`
            : `You are an AI admin assistant for a Paint & Sip business. The user is currently on ${pageContext.label}: ${pageContext.summary}. Top owner actions: ${summarizeOwnerActions()}. Help with events, venues, orders, customers, marketing, payroll, settings, analytics, and system tasks. Be helpful, clear, concise, and do not use emojis. Suggest actions but do not claim to complete sends/payments/deletes unless the user explicitly performs them.`;

          const result = await callAiGateway({
            task: 'admin_drawer_assistant',
            maxTokens: 500,
            messages: [
              { role: 'system', content: systemMessage },
              ...messages.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: input },
            ],
          });

          response = result.content || await findRelevantContent(input);
        } catch (err) {
          console.error('AI call failed:', err);
          response = await findRelevantContent(input);
        } finally {
          setIsTyping(false);
        }
      }

      const assistantMessage: Message = {
        id: `msg-${msgIdRef.current++}`,
        role: 'assistant',
        content: response,
        isNew: true,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    // Handle up/down arrow keys for message history
    if (e.key === 'ArrowUp' && messageHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? messageHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(messageHistory[newIndex]);
    } else if (e.key === 'ArrowDown' && messageHistory.length > 0) {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= messageHistory.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(messageHistory[newIndex]);
      }
    }
  };

  const handleClear = () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: getGreeting(),
    }]);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-primary-500 text-white p-3 rounded-l-lg shadow-lg hover:bg-primary-600 transition-all duration-300 z-40"
        style={{ 
          backgroundColor: 'var(--primary-color)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderBottomLeftRadius: 'var(--radius-lg)',
          marginRight: isOpen ? '24rem' : '0'
        }}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Slide-out Drawer */}
      <div 
        className="fixed right-0 top-0 h-full w-96 z-50 transform transition-transform duration-300 ease-in-out"
        style={{ 
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: 'var(--admin-bg)',
          borderLeft: '1px solid var(--border-color)'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--primary-color)' }}
        >
          <div className="flex items-center gap-2 text-white">
            {brandName ? <Sparkles className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
            <span className="font-semibold">{brandName || 'Admin Helper'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleClear}
              className="text-white/80 hover:text-white p-1"
              title="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{pageContext.label}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{pageContext.summary}</p>
            </div>
            <button
              onClick={() => {
                navigate('/admin/assistant');
                setIsOpen(false);
              }}
              className="flex-shrink-0 rounded-lg border px-2 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--admin-input-bg)' }}
            >
              Workspace
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pageContext.prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="rounded-full border px-3 py-1 text-xs transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--admin-input-bg)' }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ height: 'calc(100% - 14rem)' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white ml-8 shadow-md'
                  : 'mr-8 shadow-sm border'
              } ${msg.isNew ? 'animate-fade-in-up' : ''}`}
              style={{ 
                backgroundColor: msg.role === 'user' ? undefined : 'var(--card-bg)',
                borderColor: 'var(--border-color)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)'
              }}
              onAnimationEnd={() => {
                if (msg.isNew) {
                  setMessages(prev => prev.map(m => 
                    m.id === msg.id ? { ...m, isNew: false } : m
                  ));
                }
              }}
            >
              {msg.content}
            </div>
          ))}
          {isTyping && (
            <div className="mr-8 p-4 rounded-xl text-sm shadow-sm border animate-fade-in-up" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <div className="flex gap-1 py-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--border-color)' }}>
          <div className="flex gap-2">
            <button
              onClick={toggleListening}
              className={`p-3 rounded-xl border transition-colors ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'hover:bg-gray-100'
              }`}
              style={{ 
                backgroundColor: isListening ? undefined : 'var(--admin-input-bg)', 
                borderColor: 'var(--border-color)',
                color: isListening ? 'white' : 'var(--text-secondary)'
              }}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a question..."
              className="flex-1 px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <Button size="sm" onClick={handleSend} className="px-4">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
