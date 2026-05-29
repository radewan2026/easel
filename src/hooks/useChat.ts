import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface ChatSession {
  id: string;
  session_id: string;
  user_email: string | null;
  user_name: string | null;
  status: 'active' | 'pending' | 'human_requested' | 'in_progress' | 'closed' | 'resolved';
  admin_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  created_at: string;
}

type ChatStatusUpdate = Partial<Pick<ChatSession, 'status' | 'admin_id' | 'resolved_at' | 'updated_at'>>;

function generateSessionId(): string {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ChatSession[];
    },
    refetchInterval: 3000,
  });
}

export function usePendingChatCount() {
  return useQuery({
    queryKey: ['chat-sessions', 'pending-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'human_requested']);
      if (error) throw error;
      return data?.length || 0;
    },
    refetchInterval: 3000,
  });
}

export function useChatMessages(sessionId: string) {
  return useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!sessionId,
    refetchInterval: 3000,
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, userEmail, userName }: { sessionId: string; userEmail?: string; userName?: string }) => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          user_email: userEmail,
          user_name: userName,
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}

export function useAddChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, role, content }: { sessionId: string; role: 'user' | 'assistant' | 'admin'; content: string }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, role, content })
        .select()
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}

export function useUpdateChatStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, status, adminId }: { sessionId: string; status: ChatSession['status']; adminId?: string }) => {
      const updates: ChatStatusUpdate = { status, updated_at: new Date().toISOString() };
      if (adminId) updates.admin_id = adminId;
      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .update(updates)
        .eq('session_id', sessionId)
        .select()
        .single();
      if (error) throw error;
      return data as ChatSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}

export function useGetOrCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userEmail, userName }: { userEmail?: string; userName?: string }) => {
      let sessionId = sessionStorage.getItem('chat_session_id');
      if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem('chat_session_id', sessionId);
      }
      
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) {
        return existing as ChatSession;
      }

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          user_email: userEmail,
          user_name: userName,
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error: msgError } = await supabase.from('chat_messages').delete().eq('session_id', sessionId);
      if (msgError) {
        console.error('Error deleting messages:', msgError);
      }
      const { error } = await supabase.from('chat_sessions').delete().eq('session_id', sessionId);
      if (error) {
        console.error('Error deleting session:', error);
        throw error;
      }
    },
    onSuccess: (_, sessionId) => {
      queryClient.removeQueries({ queryKey: ['chat-sessions'] });
      queryClient.removeQueries({ queryKey: ['chat-messages', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}
