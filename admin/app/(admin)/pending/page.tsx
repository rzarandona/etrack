import { getSupabaseServer } from '@/lib/supabase/server';
import { ApproveRow, type UnlinkedEmployee } from './approve-row';

type PendingRow = {
  profile_id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function PendingPage() {
  const supabase = await getSupabaseServer();

  const { data: pendingData } = await supabase.rpc('pending_users_with_email');
  const pending = (pendingData as PendingRow[] | null) ?? [];

  // Employees with no linked user_profile_id are candidates for "link to
  // existing" approval (e.g. seeded HR records that the new signup matches).
  const { data: unlinkedData } = await supabase
    .from('employees')
    .select('id, full_name, employee_code')
    .is('user_profile_id', null)
    .eq('active', true)
    .order('employee_code');
  const unlinked = (unlinkedData as UnlinkedEmployee[] | null) ?? [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Pending Users</h1>
        <p className="text-sm mt-1 text-muted">
          {pending.length === 0
            ? 'No pending signups. New self-signups will appear here for approval.'
            : `${pending.length} signup${pending.length === 1 ? '' : 's'} awaiting approval.`}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="card p-5">
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3">Name</th>
                  <th className="font-medium pb-3">Email</th>
                  <th className="font-medium pb-3">Signed up</th>
                  <th className="font-medium pb-3 text-right">Approve as</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.profile_id} className="border-t border-line align-top">
                    <td className="py-3 pr-4 font-bold">{p.full_name}</td>
                    <td className="py-3 pr-4 text-muted">{p.email ?? <span className="opacity-60">—</span>}</td>
                    <td className="py-3 pr-4 text-muted whitespace-nowrap">{relativeTime(p.created_at)}</td>
                    <td className="py-3">
                      <ApproveRow
                        profileId={p.profile_id}
                        fullName={p.full_name}
                        unlinked={unlinked}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
