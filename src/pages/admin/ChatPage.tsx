import { useState, useEffect, useRef } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, ChevronDown, ChevronRight, Trash2, Sparkles } from 'lucide-react';
import { useChatSessions, useChatMessages, useAddChatMessage, useUpdateChatStatus, useDeleteChatSession } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';

type BrowserWindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as BrowserWindowWithAudio).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const playNotificationSound = () => {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.debug('Audio not supported', error);
  }
};

const playRingSound = () => {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.45);
    
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.6);
  } catch (error) {
    console.debug('Audio not supported', error);
  }
};

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useChatSessions();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages, isLoading: messagesLoading } = useChatMessages(selectedSession || '');
  const addMessage = useAddChatMessage();
  const updateStatus = useUpdateChatStatus();
  const deleteSession = useDeleteChatSession();
  const { showToast } = useToast();

  const allSessions = sessions || [];
  const pendingSessions = allSessions.filter(s => s.status === 'human_requested' || s.status === 'active');
  const activeSessions = sessions?.filter(s => s.status === 'in_progress') || [];
  const closedSessions = sessions?.filter(s => s.status === 'closed') || [];

  const [activeExpanded, setActiveExpanded] = useState(true);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteDialogTitle, setDeleteDialogTitle] = useState('Delete Conversation');
  const [deleteDialogMessage, setDeleteDialogMessage] = useState('Are you sure you want to delete this conversation?');

  // Play ring sound when new pending chats arrive - track previous count in ref to avoid re-renders
  const prevPendingCountRef = useRef(0);
  useEffect(() => {
    if (!sessions || sessions.length === 0) return;
    const currentPending = pendingSessions.length + activeSessions.length;
    if (prevPendingCountRef.current > 0 && currentPending > prevPendingCountRef.current) {
      playRingSound();
    }
    prevPendingCountRef.current = currentPending;
  }, [sessions, pendingSessions.length, activeSessions.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    const lastMsgCount = lastMsgCountRef.current;
    if (messages && messages.length > lastMsgCount) {
      const newMsgs = messages.slice(lastMsgCount);
      const userNewMsgs = newMsgs.filter(m => m.role === 'user');
      if (userNewMsgs.length > 0) {
        playNotificationSound();
      }
      lastMsgCountRef.current = messages.length;
    }
  }, [messages]);

  const handleSendReply = async () => {
    if (!selectedSession || !replyText.trim()) return;
    
    await addMessage.mutateAsync({
      sessionId: selectedSession,
      role: 'admin',
      content: replyText.trim()
    });
    setReplyText('');
  };

  const handleDraftReply = () => {
    const session = sessions?.find(s => s.session_id === selectedSession);
    const latestCustomerMessage = [...(messages || [])].reverse().find(msg => msg.role === 'user');
    const customerName = session?.user_name || 'there';
    const topic = latestCustomerMessage?.content
      ? `I saw your message: "${latestCustomerMessage.content.slice(0, 160)}${latestCustomerMessage.content.length > 160 ? '...' : ''}"`
      : 'Thanks for reaching out.';

    setReplyText(`Hi ${customerName}, thanks for the note. ${topic}\n\nI am checking on this now and will follow up with the best next step shortly.`);
  };

  const handleStartChat = async (sessionId: string) => {
    await addMessage.mutateAsync({
      sessionId,
      role: 'admin',
      content: 'An agent has joined the chat. How can I help you today?'
    });
    await updateStatus.mutateAsync({
      sessionId,
      status: 'in_progress',
      adminId: user?.id
    });
  };

  const handleEndChat = async (sessionId: string) => {
    try {
      await addMessage.mutateAsync({
        sessionId,
        role: 'admin',
        content: 'Agent has ended the chat. Have a nice day and please let us know if you need anything else.'
      });
      await updateStatus.mutateAsync({
        sessionId,
        status: 'closed',
        adminId: user?.id
      });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      setSelectedSession(null);
    } catch (err) {
      console.error('Error ending chat:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">New</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Active</span>;
      case 'closed':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">Closed</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Resolved</span>;
      default:
        return null;
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteSession.mutate(deleteTarget, {
        onError: (err: Error) => {
          console.error('Delete failed:', err);
          showToast('Failed to delete: ' + err.message, 'error');
        },
      });
      if (deleteTarget === selectedSession) {
        setSelectedSession(null);
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex h-[calc(100vh-8rem)]" style={{ backgroundColor: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
      {/* Conversations Sidebar */}
      <div className="w-80 border-r flex flex-col" style={{ borderColor: 'var(--border-color)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Customer Live Chat Inbox</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {pendingSessions.length + activeSessions.length} waiting or active
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Website visitor support threads live here. Ask Easel is the AI owner assistant on the dashboard.
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto" style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border-color) transparent',
        }}>
          {allSessions.length === 0 && (
            <div className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No customer chats yet</p>
              <p className="mt-2">Website visitor conversations will appear here when someone asks for human help from the public chat widget.</p>
            </div>
          )}
        {/* Active Chats */}
        {[...pendingSessions, ...activeSessions].length > 0 && (
          <div className="p-2">
            <button 
              className="px-3 py-2 text-xs font-medium uppercase flex items-center gap-2 w-full"
              onClick={() => setActiveExpanded(!activeExpanded)}
              style={{ color: 'var(--text-muted)' }}
            >
              {activeExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Active ({[...pendingSessions, ...activeSessions].length})
            </button>
            {activeExpanded && [...pendingSessions, ...activeSessions].map((session, idx) => (
                <button
                  key={session.session_id}
                  onClick={() => setSelectedSession(session.session_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all relative ${
                    selectedSession === session.session_id 
                      ? '' 
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: selectedSession === session.session_id ? 'var(--primary-color)' : 'transparent',
                    color: selectedSession === session.session_id ? 'white' : 'var(--text-primary)'
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-medium"
                    style={{ 
                      backgroundColor: selectedSession === session.session_id ? 'rgba(255,255,255,0.25)' : 'var(--primary-color)',
                      color: 'white',
                      border: '2px solid var(--card-bg)'
                    }}
                  >
                    {getInitials(session.user_name || 'Anonymous')[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {session.user_name || 'Anonymous User'}
                      </span>
                      <span className="text-xs" style={{ color: selectedSession === session.session_id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                        {formatTime(session.created_at)}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: selectedSession === session.session_id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                      {session.user_email || 'No email'}
                    </p>
                  </div>
                  {idx < [...pendingSessions, ...activeSessions].length - 1 && (
                    <div className="absolute bottom-0 left-0 right-0" style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.5 }} />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Closed Chats */}
          {closedSessions.length > 0 && (
            <div className="p-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                className="px-3 py-2 text-xs font-medium uppercase flex items-center gap-2 w-full"
                onClick={() => setClosedExpanded(!closedExpanded)}
                style={{ color: 'var(--text-muted)' }}
              >
                {closedExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Closed ({closedSessions.length})
              </button>
              {closedExpanded && closedSessions.slice(0, 10).map((session, idx) => (
                <div key={session.session_id} className="relative group">
                  <button
                    onClick={() => setSelectedSession(session.session_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:opacity-80 relative"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-medium"
                      style={{ 
                        backgroundColor: 'var(--section-bg-light)', 
                        color: 'var(--text-primary)',
                        border: '2px solid var(--border-color)'
                      }}
                    >
                      {getInitials(session.user_name || 'Anonymous')[0]}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">
                          {session.user_name || 'Anonymous User'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(session.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(session.session_id);
                      setDeleteDialogTitle('Delete Conversation');
                      setDeleteDialogMessage('Are you sure you want to delete this conversation?');
                      setShowDeleteConfirm(true);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--card-bg)' }}
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                  {idx < Math.min(closedSessions.length, 10) - 1 && (
                    <div className="absolute bottom-0 left-0 right-0" style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.5 }} />
                  )}
                </div>
              ))}
              {closedSessions.length > 10 && closedExpanded && (
                <p className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  +{closedSessions.length - 10} more
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-medium"
                  style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                >
                  {getInitials(sessions?.find(s => s.session_id === selectedSession)?.user_name || 'Anonymous')[0]}
                </div>
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {sessions?.find(s => s.session_id === selectedSession)?.user_name || 'Anonymous User'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(sessions?.find(s => s.session_id === selectedSession)?.status || '')}
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {sessions?.find(s => s.session_id === selectedSession)?.user_email || 'No email'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {(sessions?.find(s => s.session_id === selectedSession)?.status === 'active' || sessions?.find(s => s.session_id === selectedSession)?.status === 'human_requested') && (
                  <Button onClick={() => handleStartChat(selectedSession)}>
                    Accept Chat
                  </Button>
                )}
                {sessions?.find(s => s.session_id === selectedSession)?.status === 'in_progress' && (
                  <Button variant="secondary" onClick={handleDraftReply}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Draft Reply
                  </Button>
                )}
                {sessions?.find(s => s.session_id === selectedSession)?.status === 'in_progress' && (
                  <Button variant="secondary" onClick={() => handleEndChat(selectedSession)}>
                    End Chat
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  aria-label="Delete conversation"
                  onClick={() => {
                    setDeleteTarget(selectedSession);
                    setDeleteDialogTitle('Delete Conversation');
                    setDeleteDialogMessage('Are you sure you want to delete this conversation? This cannot be undone.');
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: 'var(--section-bg-light)' }}>
              {messagesLoading ? (
                <LoadingSpinner />
              ) : messages?.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet</p>
                </div>
              ) : (
                <>
                  {messages?.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.role === 'admin'
                          ? 'rounded-br-md'
                          : msg.role === 'user'
                          ? 'rounded-bl-md'
                          : 'rounded-bl-md bg-green-100 text-green-800'
                      }`} style={{
                        backgroundColor: msg.role === 'admin' 
                          ? 'var(--primary-color)' 
                          : msg.role === 'user'
                          ? 'var(--card-bg)'
                          : 'var(--section-bg-light)',
                        color: msg.role === 'admin' ? 'white' : 'var(--text-primary)',
                        border: msg.role === 'user' ? '1px solid var(--border-color)' : 'none'
                      }}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs mt-1 opacity-70">{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                  placeholder="Type your reply..."
                  className="flex-1 px-4 py-3 rounded-full border"
                  style={{ 
                    backgroundColor: 'var(--section-bg-light)', 
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
                <Button 
                  onClick={handleSendReply} 
                  disabled={!replyText.trim()}
                  className="!px-4 rounded-full"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                {allSessions.length ? 'Select a customer conversation' : 'No active customer chats'}
              </p>
              <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                {allSessions.length
                  ? 'Choose a website visitor thread from the list on the left.'
                  : 'This inbox is for live support conversations from the public website. Use Ask Easel from the dashboard for the AI owner assistant.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={deleteDialogTitle}
        message={deleteDialogMessage}
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
