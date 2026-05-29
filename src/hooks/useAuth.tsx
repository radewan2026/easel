/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { AdminRole, EmployeePermissions } from '../types/database';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  adminRole: AdminRole;
  avatar_url: string | null;
  permissions: EmployeePermissions | null;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        loadEmployeeByEmail(session.user.email || session.user.id).then((employee) => {
          if (mounted) setUser(employee);
        }).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        loadEmployeeByEmail(session.user.email || session.user.id).then((employee) => {
          if (mounted) setUser(employee);
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

async function loadEmployeeByEmail(emailOrId: string): Promise<AdminUser | null> {
  try {
    const { data } = await supabase
      .from('employees')
      .select('id, email, name, admin_role, avatar_url, permissions')
      .or(`email.eq.${emailOrId},user_id.eq.${emailOrId}`)
      .neq('admin_role', 'none')
      .single();

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      adminRole: data.admin_role as AdminRole,
      avatar_url: data.avatar_url,
      permissions: data.permissions as EmployeePermissions | null,
    };
  } catch {
    return null;
  }
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useIsAdmin() {
  const { user, loading } = useAuth();
  return { isAdmin: !!user, loading };
}
