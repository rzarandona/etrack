import { CashAdvanceStatusPill } from '@/lib/components/pills';
import { formatMoney } from '@/lib/format';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { CashAdvance, CashAdvanceStatus } from '@/lib/types';
import type { EmployeeOption, EventOption } from './advance-form';
import { FilterBar } from './filter-bar';
import { NewAdvanceButton } from './new-advance-button';
import { RowActions } from './row-actions';

type Row = CashAdvance & {
  user: { id: string; full_name: string } | null;
  applied_event: { id: string; title: string } | null;
};

function fmtDate(s: string): string {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function CashAdvancesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServer();

  // Active employees with a linked user_profile — these are the users who can
  // receive an advance (cash_advances.user_id FK -> user_profiles.id).
  const { data: empData } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, user_profile_id')
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

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, title, starts_at')
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: false })
    .limit(100);
  const events: EventOption[] = (eventsData as EventOption[]) ?? [];

  let q = supabase
    .from('cash_advances')
    .select('*, user:user_profiles(id, full_name), applied_event:events(id, title)')
    .order('advance_date', { ascending: false });

  if (params.user) q = q.eq('user_id', params.user);
  if (params.status && ['pending', 'applied', 'deferred', 'cancelled'].includes(params.status)) {
    q = q.eq('status', params.status as CashAdvanceStatus);
  }

  const { data } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  // Summary stats
  const totals = rows.reduce(
    (acc, r) => {
      const amount = Number(r.amount);
      acc.count += 1;
      if (r.status === 'pending') acc.pending += amount;
      if (r.status === 'applied') acc.applied += amount;
      if (r.status === 'deferred') acc.deferred += amount;
      return acc;
    },
    { count: 0, pending: 0, applied: 0, deferred: 0 }
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cash Advances</h1>
          <p className="text-sm mt-1 text-muted">
            {totals.count} record{totals.count === 1 ? '' : 's'} · pending {formatMoney(totals.pending)} · applied {formatMoney(totals.applied)} · deferred {formatMoney(totals.deferred)}
          </p>
        </div>
        <NewAdvanceButton employees={employees} events={events} />
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
            {params.user || params.status
              ? 'No advances match the current filters.'
              : 'No cash advances yet. Use Record advance to add one.'}
          </p>
        ) : (
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3 pr-4">Employee</th>
                  <th className="font-medium pb-3 pr-4 text-right">Amount</th>
                  <th className="font-medium pb-3 pr-4">Date</th>
                  <th className="font-medium pb-3 pr-4">Status</th>
                  <th className="font-medium pb-3 pr-4">Applied to</th>
                  <th className="font-medium pb-3 pr-4">Notes</th>
                  <th className="font-medium pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-3 pr-4 font-bold">
                      {r.user?.full_name ?? <span className="opacity-60">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{formatMoney(r.amount)}</td>
                    <td className="py-3 pr-4 text-muted whitespace-nowrap">{fmtDate(r.advance_date)}</td>
                    <td className="py-3 pr-4">
                      <CashAdvanceStatusPill status={r.status} />
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {r.applied_event?.title ?? <span className="opacity-60">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted text-xs max-w-[240px]">
                      {r.notes ?? <span className="opacity-60">—</span>}
                    </td>
                    <td className="py-3">
                      <RowActions advance={r} employees={employees} events={events} />
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
