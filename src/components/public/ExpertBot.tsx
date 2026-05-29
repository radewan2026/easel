import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Headphones, RotateCcw, ChevronUp } from 'lucide-react';
import { useSettings } from '../../hooks/useAdmin';
import { useAddChatMessage, useChatMessages } from '../../hooks/useChat';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { callAiGateway } from '../../lib/aiGateway';

const HUMAN_KEYWORDS = [
  'talk to human', 'speak to someone', 'need help', 'talk to a person', 'speak to human', 
  'real person', 'agent', 'customer service', 'speak to manager', 'talk to manager', 
  'human support', 'talk to support', 'chat with human', 'talk to a human', 'speak to a human',
  'contact human', 'talk to person', 'human here', 'want to talk to someone', 'can i talk to a human',
  'get help from person', 'talk to live person', 'talk to real person', 'need person help',
  'need agent', 'need live support', 'want to talk to someone', 'speak to an agent'
];

const DEFAULT_ANSWER = "Thanks for your question! For specific inquiries, I'd recommend:\n\n• **Booking & Orders**: Check your email confirmation or visit our Events page\n• **Pricing**: Check our Events page for current pricing\n• **Private Parties**: Visit the Private Parties page\n• **General Questions**: Email us at hello@paintandsip.com";

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
    return "Our painting events typically range from $45-75 per person depending on the event. Check our Events page for current pricing and available spots!";
  }
  if (lower.includes('upcoming') || lower.includes('event') || lower.includes('schedule') || lower.includes('calendar')) {
    return "You can see all our upcoming events on the Events page. We add new events regularly, so check back often!";
  }
  if (lower.includes('book') || lower.includes('register') || lower.includes('sign up')) {
    return "To book a spot, simply visit our Events page, choose your event, and click 'Book Now'! You'll receive a confirmation email with all the details.";
  }
  if (lower.includes('private') || lower.includes('party')) {
    return "We'd love to host your private party! Visit our Private Parties page to submit a request, or talk to a human for more details.";
  }
  if (lower.includes('location') || lower.includes('where') || lower.includes('venue')) {
    return "We're located at various venues in the area. Check our Venues page for our current partner locations!";
  }
  if (lower.includes('cancel') || lower.includes('refund')) {
    return "For cancellations or refunds, please contact us at hello@paintandsip.com at least 48 hours before your event for a full refund.";
  }
  if (lower.includes('gift')) {
    return "We offer gift cards! Visit our Gift Cards page to purchase one for a friend.";
  }
  
  return DEFAULT_ANSWER;
}

function generateSessionId(): string {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

export default function ExpertBot() {
  const [sessionId] = useState(() => {
    let stored = sessionStorage.getItem('chat_session_id');
    if (!stored) {
      stored = generateSessionId();
      sessionStorage.setItem('chat_session_id', stored);
    }
    return stored;
  });
  
  const { user } = useAuth();
  const addMessage = useAddChatMessage();
  const { data: chatMessages } = useChatMessages(sessionId);
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  
  useEffect(() => {
    const fetchSessionStatus = async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('status')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (error) return;
      if (data) setSessionStatus(data.status);
    };
    fetchSessionStatus();
    const interval = setInterval(fetchSessionStatus, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);
  
  const agentEngaged = sessionStatus === 'in_progress' || sessionStatus === 'human_requested';
  
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([
    { role: 'bot', text: "Hi there! 👋 I'm your Paint & Sip expert. Ask me anything about our events, booking, painting tips, pricing, or anything else!" },
  ]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [humanRequested, setHumanRequested] = useState(false);
  const [askingName, setAskingName] = useState(false);
  const [askingEmail, setAskingEmail] = useState(false);
  const [userName, setUserName] = useState('');
  const lastMessageCountRef = useRef(0);
  const initializedChatMessagesRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useSettings();
  const brandName = settings?.find((s) => s.key === 'brandName')?.value || 'Paint & Sip';
  const brandPersona = settings?.find((s) => s.key === 'brandPersona')?.value || '';

  const quickActions = !agentEngaged ? [
    { label: 'Upcoming Events', action: 'show events' },
    { label: 'Pricing', action: 'how much does it cost' },
    { label: 'How to Book', action: 'how do I book an event' },
    { label: 'Talk to Human', action: 'talk to human', isHuman: true },
  ] : [];

  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      if (!initializedChatMessagesRef.current) {
        lastMessageCountRef.current = chatMessages.length;
        initializedChatMessagesRef.current = true;
        return;
      }
      if (chatMessages.length > lastMessageCountRef.current) {
        const newMessages = chatMessages.slice(lastMessageCountRef.current);
        newMessages.forEach(msg => {
          if (msg.role === 'admin') {
            setMessages(prev => [...prev, { role: 'bot', text: msg.content }]);
          }
        });
        lastMessageCountRef.current = chatMessages.length;
      }
    }
  }, [chatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleHumanRequest = async () => {
    setHumanRequested(true);
    setAskingName(true);
    setMessages(prev => [...prev, { 
      role: 'bot', 
      text: "I'd be happy to connect you with a human agent! What's your name?" 
    }]);
  };

  const submitHumanRequest = async (name: string, email?: string) => {
    setAskingName(false);
    setAskingEmail(false);
    setIsTyping(false);
    const displayName = name || user?.name || 'Anonymous';
    const displayEmail = email || user?.email || null;
    
    setMessages(prev => [...prev, { 
      role: 'bot', 
      text: "I've connected you with a human agent. They will be with you shortly!" 
    }]);

    await supabase.from('chat_sessions').upsert({ 
      session_id: sessionId, 
      status: 'human_requested',
      user_email: displayEmail,
      user_name: displayName,
      updated_at: new Date().toISOString()
    }, { onConflict: 'session_id' });
  };

  const handleSend = async () => {
    if (askingName || askingEmail) {
      if (!input.trim()) return;
    } else if (isTyping) {
      return;
    }

    const userMessage = input.trim();
    
    if (askingName) {
      setUserName(userMessage);
      setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
      setInput('');
      setIsTyping(false);
      setAskingName(false);
      setAskingEmail(true);
      setMessages(prev => [...prev, { role: 'bot', text: "Thanks! What's your email address?" }]);
      return;
    }

    if (askingEmail) {
      setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
      setInput('');
      setIsTyping(false);
      setAskingEmail(false);
      await submitHumanRequest(userName, userMessage);
      return;
    }
    
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsTyping(true);
    addMessage.mutate({ sessionId, role: 'user', content: userMessage });

    if (agentEngaged) {
      setIsTyping(false);
      return;
    }

    const lowerMessage = userMessage.toLowerCase();
    if (HUMAN_KEYWORDS.some(keyword => lowerMessage.includes(keyword)) && !humanRequested) {
      setIsTyping(false);
      setTimeout(() => {
        handleHumanRequest();
      }, 500);
      return;
    }

    const callAI = async (userMsg: string) => {
      setMessages(prev => [...prev, { role: 'bot', text: 'Thinking...' }]);

      const lowerMsg = userMsg.toLowerCase();
      const isEventQuery = lowerMsg.includes('event') || lowerMsg.includes('upcoming') || lowerMsg.includes('schedule') || lowerMsg.includes('calendar');
      let eventsInfo = '';
      
      if (isEventQuery) {
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        const { data: upcomingEvents } = await supabase
          .from('events')
          .select('title, start_datetime, base_price_per_seat, seats_available')
          .eq('is_published', true)
          .gte('start_datetime', new Date().toISOString())
          .lte('start_datetime', twoWeeksFromNow.toISOString())
          .order('start_datetime')
          .limit(10);
        
        if (upcomingEvents && upcomingEvents.length > 0) {
          eventsInfo = '\n\nUpcoming events (next 2 weeks):\n' + upcomingEvents.map(e => {
            const date = new Date(e.start_datetime);
            const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return `- ${e.title} on ${dateStr} at ${timeStr}, $${e.base_price_per_seat}, ${e.seats_available} seats left`;
          }).join('\n');
        }
      }

      const systemMessage = brandName && brandPersona
        ? `You are a helpful AI assistant for ${brandName}. Your brand persona: ${brandPersona}. Be friendly, helpful, and conversational.${eventsInfo}`
        : `You are a helpful AI assistant for a Paint & Sip business. Be friendly, helpful, and conversational.${eventsInfo}`;

      try {
        const result = await callAiGateway({
          task: 'public_customer_chat',
          maxTokens: 500,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMsg },
          ],
        });

        const reply = result.content || getBotResponse(userMsg);
        
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: 'bot', text: reply };
          return newMsgs;
        });
        addMessage.mutate({ sessionId, role: 'assistant', content: reply });
      } catch (err) {
        console.error('AI call failed:', err);
        const response = getBotResponse(userMsg);
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: 'bot', text: response };
          return newMsgs;
        });
      }
      setIsTyping(false);
    };

    setTimeout(async () => {
      await callAI(userMessage);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 p-3 rounded-l-lg shadow-lg transition-all duration-300"
        style={{ 
          backgroundColor: 'var(--primary-color)',
          marginRight: isOpen ? '24rem' : '0'
        }}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageCircle className="h-5 w-5 text-white" />
        )}
      </button>

      {isOpen && (
        <div 
          className="fixed right-0 top-0 h-full w-96 z-50 transform transition-transform duration-300 ease-in-out flex flex-col"
          style={{ 
            transform: 'translateX(0)',
            backgroundColor: 'var(--card-bg)',
            borderLeft: '1px solid var(--border-color)'
          }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--primary-color)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                {askingName || askingEmail ? <Sparkles className="h-4 w-4 text-white" /> : agentEngaged ? <Headphones className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{askingName ? 'Your Name' : askingEmail ? 'Your Email' : agentEngaged ? 'Support Chat' : brandName}</p>
                <p className="text-white/70 text-xs">{askingName ? 'Please enter your name' : askingEmail ? 'Please enter your email' : agentEngaged ? 'Agent will reply shortly' : 'Online'}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
                sessionStorage.setItem('chat_session_id', newSessionId);
                setMessages([{ role: 'bot', text: "Hi there! 👋 I'm your Paint & Sip expert. Ask me anything about our events, booking, painting tips, pricing, or anything else!" }]);
                lastMessageCountRef.current = 0;
                initializedChatMessagesRef.current = false;
                setAskingName(false);
                setAskingEmail(false);
                setHumanRequested(false);
                setSessionStatus('active');
              }}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              title="New conversation"
            >
              <RotateCcw className="h-4 w-4 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: 'var(--section-bg-light)' }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm"
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : 'var(--card-bg)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 2 && !isTyping && (
            <div className="px-4 py-2 flex gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border-color)' }}>
              {quickActions.slice(0, 3).map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (action.isHuman) {
                      handleHumanRequest();
                    } else {
                      setInput(action.action);
                      setTimeout(() => handleSend(), 100);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={askingName ? 'Enter your name...' : askingEmail ? 'Enter your email...' : 'Type a message...'}
                className="flex-1 px-4 py-2 rounded-lg border text-sm"
                style={{ 
                  backgroundColor: 'var(--section-bg-light)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!isOpen && <ScrollToTopButton />}
    </>
  );
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg bg-gray-700 hover:bg-gray-800 flex items-center justify-center transition-all hover:scale-110 z-30"
      title="Back to top"
    >
      <ChevronUp className="h-6 w-6 text-white" />
    </button>
  );
}
