import { requireAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const supabase = await getSupabaseServer();
  const { count } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'pending')
    .eq('active', true);
  return (
    <AdminShell profile={profile} pendingCount={count ?? 0}>
      {children}
    </AdminShell>
  );
}
