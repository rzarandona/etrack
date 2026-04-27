import Link from 'next/link';
import { Avatar } from '@/lib/components/avatar';
import { ScanTypePill } from '@/lib/components/pills';
import { formatScanWhen } from '@/lib/format';
import { getSupabaseServer } from '@/lib/supabase/server';

type RecentRow = {
  id: string;
  scan_type: 'in' | 'out';
  server_timestamp: string;
  employee: { full_name: string; employee_code: string } | null;
};

export default async function Dashboard() {
  const supabase = await getSupabaseServer();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    { count: scansToday },
    { count: activeEmployees },
    { count: mockFlags },
    { count: upcomingEvents },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('server_timestamp', startOfDay.toISOString()),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('server_timestamp', startOfDay.toISOString())
      .eq('is_mock_location', true),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('starts_at', new Date().toISOString())
      .neq('status', 'cancelled'),
    supabase
      .from('scans')
      .select(
        'id, scan_type, server_timestamp, employee:employees(full_name, employee_code)'
      )
      .order('server_timestamp', { ascending: false })
      .limit(8),
  ]);

  const recentRows = (recent as unknown as RecentRow[]) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Workforce overview</h1>
          <p className="text-sm mt-1 text-muted">
            Track scans, manage employees, and prep payroll.
          </p>
        </div>
        <Link href="/employees/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add employee
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat
          label="Active employees"
          value={activeEmployees ?? 0}
          href="/employees"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <Stat
          label="Scans today"
          value={scansToday ?? 0}
          href="/scans"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
        <Stat
          label="Mock-location flags today"
          value={mockFlags ?? 0}
          href="/scans?mock=1"
          warn={(mockFlags ?? 0) > 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
        <Stat
          label="Upcoming events"
          value={upcomingEvents ?? 0}
          href="/events"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          }
        />
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Recent scan activity</h2>
            <p className="text-xs text-muted">
              Latest clock-in / clock-out events from the field.
            </p>
          </div>
          <Link href="/scans" className="btn-secondary !py-2 !px-3 !text-xs !rounded-full">
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto scroll-hide">
          {recentRows.length === 0 ? (
            <p className="py-8 text-center text-muted">No scans yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3">Employee</th>
                  <th className="font-medium pb-3">Type</th>
                  <th className="font-medium pb-3 text-right pr-2">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((r) => (
                  <tr key={r.id} className="table-row border-t border-line">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.employee?.full_name ?? '?'} size="sm" />
                        <div>
                          <div className="font-bold">{r.employee?.full_name ?? '—'}</div>
                          <div className="text-xs text-muted">
                            {r.employee?.employee_code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <ScanTypePill type={r.scan_type} />
                    </td>
                    <td className="py-3 text-right pr-2 text-muted">
                      {formatScanWhen(r.server_timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  icon,
  warn,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="card p-5 block transition hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted">{label}</div>
          <div className={`text-3xl font-extrabold mt-2 ${warn && value > 0 ? 'text-deep' : ''}`}>
            {value}
          </div>
        </div>
        <div className="stat-icon w-10 h-10 rounded-xl flex items-center justify-center text-ink">
          {icon}
        </div>
      </div>
    </Link>
  );
}
