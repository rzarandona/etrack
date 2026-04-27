import { Avatar } from '@/lib/components/avatar';
import { MockFlagPill, ScanTypePill } from '@/lib/components/pills';
import { formatScanWhen } from '@/lib/format';
import { signPaths } from '@/lib/storage';
import { getSupabaseServer } from '@/lib/supabase/server';
import { FilterBar } from './filter-bar';
import { PhotoThumb } from './photo-viewer';

type Row = {
  id: string;
  scan_type: 'in' | 'out';
  server_timestamp: string;
  is_mock_location: boolean;
  self_clocked: boolean;
  verification_photo_url: string | null;
  latitude: string;
  longitude: string;
  employee: { full_name: string; employee_code: string } | null;
  event: { id: string; title: string } | null;
  phase: { id: string; name: string } | null;
};

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{
    mock?: string;
    q?: string;
    type?: string;
    event?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServer();

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, title')
    .order('starts_at', { ascending: false });
  const events = eventsData ?? [];

  let employeeIdFilter: string[] | null = null;
  if (params.q) {
    const term = `%${params.q.trim()}%`;
    const { data: matches } = await supabase
      .from('employees')
      .select('id')
      .or(`full_name.ilike.${term},employee_code.ilike.${term}`);
    employeeIdFilter = (matches ?? []).map((m) => m.id as string);
    if (employeeIdFilter.length === 0) {
      return (
        <ScansShell events={events} count={0}>
          <p className="py-10 text-center text-muted">No scans match the current filters.</p>
        </ScansShell>
      );
    }
  }

  let query = supabase
    .from('scans')
    .select(
      'id, scan_type, server_timestamp, is_mock_location, self_clocked, verification_photo_url, latitude, longitude, employee:employees(full_name, employee_code), event:events(id, title), phase:event_phases(id, name)'
    )
    .order('server_timestamp', { ascending: false })
    .limit(200);

  if (params.mock === '1') query = query.eq('is_mock_location', true);
  if (params.type === 'in' || params.type === 'out') query = query.eq('scan_type', params.type);
  if (params.event) query = query.eq('event_id', params.event);
  if (params.from) query = query.gte('server_timestamp', `${params.from}T00:00:00.000Z`);
  if (params.to) query = query.lte('server_timestamp', `${params.to}T23:59:59.999Z`);
  if (employeeIdFilter) query = query.in('employee_id', employeeIdFilter);

  const { data } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  const photoUrlByPath = await signPaths(
    supabase,
    'scan-photos',
    rows.map((r) => r.verification_photo_url).filter((p): p is string => Boolean(p))
  );

  return (
    <ScansShell events={events} count={rows.length}>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-muted">No scans match the current filters.</p>
      ) : (
        <div className="overflow-x-auto scroll-hide">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="font-medium pb-3">When</th>
                <th className="font-medium pb-3">Employee</th>
                <th className="font-medium pb-3">Type</th>
                <th className="font-medium pb-3">Event / Phase</th>
                <th className="font-medium pb-3">Location</th>
                <th className="font-medium pb-3">Flags</th>
                <th className="font-medium pb-3 text-right">Photo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="table-row border-t border-line">
                  <td className="py-3 text-muted">{formatScanWhen(r.server_timestamp)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.employee?.full_name ?? '?'} size="sm" />
                      <div>
                        <div className="font-bold">{r.employee?.full_name ?? '—'}</div>
                        <div className="text-xs text-muted">{r.employee?.employee_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <ScanTypePill type={r.scan_type} />
                      {r.self_clocked && (
                        <span className="text-xs text-muted">selfie</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-muted">
                    {r.event ? (
                      <div>
                        <div className="font-medium text-ink">{r.event.title}</div>
                        {r.phase && <div className="text-xs">{r.phase.name}</div>}
                      </div>
                    ) : (
                      <span className="opacity-60">—</span>
                    )}
                  </td>
                  <td className="py-3 font-mono text-xs text-muted">
                    {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                  </td>
                  <td className="py-3">{r.is_mock_location && <MockFlagPill />}</td>
                  <td className="py-3 text-right">
                    <PhotoThumb
                      url={r.verification_photo_url ? photoUrlByPath[r.verification_photo_url] ?? null : null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ScansShell>
  );
}

function ScansShell({
  events,
  count,
  children,
}: {
  events: { id: string; title: string }[];
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Scans</h1>
        <p className="text-sm mt-1 text-muted">
          Showing {count} scan{count === 1 ? '' : 's'} (most recent 200 within filters).
        </p>
      </div>

      <FilterBar events={events} />

      <div className="card p-5">{children}</div>
    </div>
  );
}
