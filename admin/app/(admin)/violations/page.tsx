import { ResolutionPill, ViolationSeverityPill } from '@/lib/components/pills';
import { formatDateTime } from '@/lib/format';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Violation, ViolationSeverity } from '@/lib/types';
import { FilterBar } from './filter-bar';
import { NewViolationButton } from './new-violation-button';
import { RowActions } from './row-actions';
import type { EmployeeOption, EventOption } from './violation-form';

type Row = Violation & {
  employee: { id: string; full_name: string } | null;
  reporter: { id: string; full_name: string } | null;
  event: { id: string; title: string } | null;
  phase: { id: string; name: string } | null;
};

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; severity?: string; resolved?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServer();

  // Active employees with linked profile (FK target on violations.employee_id).
  const { data: empData } = await supabase
    .from('employees')
    .select('employee_code, full_name, user_profile_id')
    .eq('active', true)
    .not('user_profile_id', 'is', null)
    .order('full_name');
  const employees: EmployeeOption[] = (empData ?? [])
    .filter((e) => e.user_profile_id)
    .map((e) => ({
      id: e.user_profile_id as string,
      full_name: e.full_name as string,
      employee_code: e.employee_code as string,
    }));

  // Events with phases for the form's event/phase pickers.
  const { data: eventsData } = await supabase
    .from('events')
    .select('id, title, starts_at, event_phases(id, name, ord)')
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: false })
    .limit(100);
  const events: EventOption[] =
    (eventsData ?? []).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      starts_at: e.starts_at as string,
      phases: ((e as { event_phases?: { id: string; name: string; ord: number }[] }).event_phases ?? [])
        .slice()
        .sort((a, b) => a.ord - b.ord),
    })) ?? [];

  let q = supabase
    .from('violations')
    .select(
      'id, event_id, phase_id, reported_by, employee_id, description, severity, resolved, resolved_at, created_at,' +
        ' employee:user_profiles!violations_employee_id_fkey(id, full_name),' +
        ' reporter:user_profiles!violations_reported_by_fkey(id, full_name),' +
        ' event:events(id, title),' +
        ' phase:event_phases(id, name)'
    )
    .order('created_at', { ascending: false });

  if (params.employee) q = q.eq('employee_id', params.employee);
  if (params.severity && ['minor', 'major', 'critical'].includes(params.severity)) {
    q = q.eq('severity', params.severity as ViolationSeverity);
  }
  if (params.resolved === 'true') q = q.eq('resolved', true);
  else if (params.resolved === 'false') q = q.eq('resolved', false);

  const { data } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      if (!r.resolved) acc.open += 1;
      return acc;
    },
    { total: 0, open: 0 }
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Violations</h1>
          <p className="text-sm mt-1 text-muted">
            {totals.open} open · {totals.total} total
          </p>
        </div>
        <NewViolationButton employees={employees} events={events} />
      </div>

      <FilterBar
        employees={employees.map((e) => ({
          id: e.id,
          full_name: e.full_name,
          employee_code: e.employee_code,
        }))}
      />

      <div className="card p-5">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-muted">
            {params.employee || params.severity || params.resolved
              ? 'No violations match the current filters.'
              : 'No violations on record.'}
          </p>
        ) : (
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3 pr-4">Employee</th>
                  <th className="font-medium pb-3 pr-4">Severity</th>
                  <th className="font-medium pb-3 pr-4">Status</th>
                  <th className="font-medium pb-3 pr-4">Event</th>
                  <th className="font-medium pb-3 pr-4">Description</th>
                  <th className="font-medium pb-3 pr-4">Reported by</th>
                  <th className="font-medium pb-3 pr-4">Reported</th>
                  <th className="font-medium pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-3 pr-4 font-bold">
                      {r.employee?.full_name ?? <span className="opacity-60">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <ViolationSeverityPill severity={r.severity} />
                    </td>
                    <td className="py-3 pr-4">
                      <ResolutionPill resolved={r.resolved} />
                    </td>
                    <td className="py-3 pr-4 text-muted text-xs">
                      {r.event ? (
                        <>
                          {r.event.title}
                          {r.phase && <div className="opacity-70">{r.phase.name}</div>}
                        </>
                      ) : (
                        <span className="opacity-60">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted text-xs max-w-[280px]">
                      {r.description}
                    </td>
                    <td className="py-3 pr-4 text-muted text-xs">
                      {r.reporter?.full_name ?? <span className="opacity-60">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted text-xs whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="py-3">
                      <RowActions violation={r} employees={employees} events={events} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
