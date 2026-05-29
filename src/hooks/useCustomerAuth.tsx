/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface CustomerUser {
  email: string;
  name?: string | null;
  authUserId?: string | null;
}

interface CustomerAuthContextValue {
  customer: CustomerUser | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      if (user?.email) {
        setCustomer({
          email: normalizeEmail(user.email),
          name: (user.user_metadata?.full_name as string | undefined) || null,
          authUserId: user.id,
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const user = session?.user;
      if (user?.email) {
        setCustomer({
          email: normalizeEmail(user.email),
          name: (user.user_metadata?.full_name as string | undefined) || null,
          authUserId: user.id,
        });
      } else {
        setCustomer(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<CustomerAuthContextValue>(() => ({
    customer,
    loading,
    sendMagicLink: async (email: string) => {
      const normalized = normalizeEmail(email);
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) throw error;
    },
    logout: async () => {
      await supabase.auth.signOut();
      setCustomer(null);
    },
  }), [customer, loading]);

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
