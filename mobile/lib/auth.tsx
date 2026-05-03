import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { UserProfile } from './types';

type AuthState = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (existing) {
        setProfile(existing as UserProfile);
        return;
      }
      // First sign-in after email-confirm signup: no profile row yet.
      // Create a pending row so the home screen can route to "Awaiting approval".
      const fullName =
        (session.user.user_metadata?.full_name as string | undefined)?.trim() ||
        session.user.email ||
        'New user';
      const { data: created } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: session.user.id,
          full_name: fullName,
          role: 'pending',
          active: true,
        })
        .select('*')
        .single();
      if (cancelled) return;
      setProfile((created as UserProfile) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value: AuthState = {
    session,
    profile,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
