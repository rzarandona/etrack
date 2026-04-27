import Link from 'next/link';
import { EventStatusPill } from '@/lib/components/pills';
import { formatDateTime, formatMoney } from '@/lib/format';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { EventRecord } from '@/lib/types';
import { Calendar } from './calendar';
import { StatusFilter } from './status-filter';

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; month?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === 'calendar' ? 'calendar' : 'table';

  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth();
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split('-').map(Number);
    calYear = y;
    calMonth = m - 1;
  }

  const supabase = await getSupabaseServer();

  if (view === 'calendar') {
    const monthStart = new Date(calYear, calMonth, 1).toISOString();
    const monthEnd = new Date(calYear, calMonth + 1, 1).toISOString();
    const { data } = await supabase
      .from('events')
      .select('id, title, starts_at, status')
      .gte('starts_at', monthStart)
      .lt('starts_at', monthEnd)
      .order('starts_at');
    const events = data ?? [];

    const monthLabel = new Date(calYear, calMonth, 1).toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });

    return (
      <div>
        <Header view={view} count={events.length} />
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">{monthLabel}</h2>
            <div className="flex items-center gap-2">
              <Link
                href={`/events?view=calendar&month=${shiftMonth(calYear, calMonth, -1)}`}
                className="btn-secondary !py-1.5 !px-3 !text-xs">
                ←
              </Link>
              <Link
                href={`/events?view=calendar`}
                className="btn-secondary !py-1.5 !px-3 !text-xs">
                Today
              </Link>
              <Link
                href={`/events?view=calendar&month=${shiftMonth(calYear, calMonth, 1)}`}
                className="btn-secondary !py-1.5 !px-3 !text-xs">
                →
              </Link>
            </div>
          </div>
          <Calendar year={calYear} month={calMonth} events={events} />
        </div>
      </div>
    );
  }

  // ============ Table view ============
  let query = supabase.from('events').select('*').order('starts_at', { ascending: false });
  if (params.status === 'planned' || params.status === 'in_progress' || params.status === 'completed' || params.status === 'cancelled') {
    query = query.eq('status', params.status);
  }
  const { data } = await query;
  const events = (data as EventRecord[]) ?? [];

  // Count assigned employees per event for the table summary
  const ids = events.map((e) => e.id);
  const countByEvent: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: assignments } = await supabase
      .from('event_assignments')
      .select('event_id')
      .in('event_id', ids);
    for (const a of assignments ?? []) {
      countByEvent[a.event_id as string] = (countByEvent[a.event_id as string] ?? 0) + 1;
    }
  }

  return (
    <div>
      <Header view={view} count={events.length} status={params.status} />
      <div className="card p-5">
        {events.length === 0 ? (
          <p className="py-10 text-center text-muted">No events match.</p>
        ) : (
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3">Event</th>
                  <th className="font-medium pb-3">When</th>
                  <th className="font-medium pb-3">Contact</th>
                  <th className="font-medium pb-3 text-right">Contract</th>
                  <th className="font-medium pb-3 text-right pr-3">Crew</th>
                  <th className="font-medium pb-3 pl-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="table-row border-t border-line cursor-pointer">
                    <td className="py-3">
                      <Link href={`/events/${e.id}`} className="block">
                        <div className="font-bold">{e.title}</div>
                        {e.venue && (
                          <div className="text-xs text-muted truncate max-w-md">{e.venue}</div>
                        )}
                      </Link>
                    </td>
                    <td className="py-3 text-muted">
                      <Link href={`/events/${e.id}`} className="block">
                        {formatDateTime(e.starts_at)}
                      </Link>
                    </td>
                    <td className="py-3 text-muted">
                      <Link href={`/events/${e.id}`} className="block">
                        {e.contact_person ?? <span className="opacity-60">—</span>}
                      </Link>
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      <Link href={`/events/${e.id}`} className="block">
                        {e.contract_price ? formatMoney(e.contract_price) : <span className="text-muted">—</span>}
                      </Link>
                    </td>
                    <td className="py-3 text-right tabular-nums pr-3">
                      <Link href={`/events/${e.id}`} className="block">
                        {countByEvent[e.id] ?? 0}
                      </Link>
                    </td>
                    <td className="py-3 pl-2">
                      <Link href={`/events/${e.id}`} className="block">
                        <EventStatusPill status={e.status} />
                      </Link>
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

function Header({ view, count, status }: { view: 'table' | 'calendar'; count: number; status?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Events</h1>
        <p className="text-sm mt-1 text-muted">
          {view === 'calendar'
            ? `${count} event${count === 1 ? '' : 's'} this month.`
            : `${count} event${count === 1 ? '' : 's'}${status ? ` · ${status}` : ''}.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ViewToggle current={view} status={status} />
        {view === 'table' && (
          <StatusFilter current={status} />
        )}
        <Link href="/events/new" className="btn-primary whitespace-nowrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New event
        </Link>
      </div>
    </div>
  );
}

function ViewToggle({ current, status }: { current: 'table' | 'calendar'; status?: string }) {
  const tableHref = `/events${status ? `?status=${status}` : ''}`;
  const calHref = `/events?view=calendar`;
  return (
    <div className="inline-flex items-center rounded-full ring-soft bg-card p-1 gap-1">
      <Link
        href={tableHref}
        className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition"
        style={
          current === 'table'
            ? { background: 'var(--ink)', color: 'white' }
            : { color: 'var(--muted)' }
        }>
        Table
      </Link>
      <Link
        href={calHref}
        className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition"
        style={
          current === 'calendar'
            ? { background: 'var(--ink)', color: 'white' }
            : { color: 'var(--muted)' }
        }>
        Calendar
      </Link>
    </div>
  );
}

