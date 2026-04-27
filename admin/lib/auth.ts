import { redirect } from 'next/navigation';
import { getSupabaseServer } from './supabase/server';
import type { SupervisorProfile } from './types';

/**
 * Server-component helper. Redirects to /login if the caller is not signed in
 * or is not an active admin. Returns the authed user + profile on success.
 */
export async function requireAdmin(): Promise<{
  userId: string;
  profile: SupervisorProfile;
}> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('supervisor_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.active || profile.role !== 'admin') {
    redirect('/login?error=admin-only');
  }

  return { userId: user.id, profile: profile as SupervisorProfile };
}
