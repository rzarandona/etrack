import Link from 'next/link';

type Slim = {
  id: string;
  title: string;
  starts_at: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
};

const PILL_BG: Record<Slim['status'], string> = {
  planned: 'bg-amber-soft',
  in_progress: 'bg-rose-soft',
  completed: 'bg-green-soft',
  cancelled: 'bg-soft',
};

const PILL_TXT: Record<Slim['status'], string> = {
  planned: 'text-deep',
  in_progress: 'text-deep',
  completed: 'text-ink',
  cancelled: 'text-muted',
};

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Month-grid calendar. Renders the Monday-aligned 6-week grid for the given
 * month and drops events on their starts_at date. Click an event to open the
 * detail page. Prev/next month is URL-driven via ?month=YYYY-MM.
 */
export function Calendar({
  year,
  month,
  events,
}: {
  year: number;
  month: number; // 0-based
  events: Slim[];
}) {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const eventsByDay: Record<string, Slim[]> = {};
  for (const e of events) {
    const d = new Date(e.starts_at);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const key = ymd(d.getFullYear(), d.getMonth(), d.getDate());
    (eventsByDay[key] ??= []).push(e);
  }

  const cells: { day: number | null; key: string | null }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ day: null, key: null });
    } else {
      cells.push({ day: dayNum, key: ymd(year, month, dayNum) });
    }
  }

  const today = new Date();
  const isToday = (d: number | null) =>
    d != null &&
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d;

  return (
    <div>
      <div className="grid grid-cols-7 text-xs uppercase tracking-wide text-muted mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-1 font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-soft rounded-xl overflow-hidden ring-soft">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`min-h-[110px] p-2 bg-card ${
              isToday(c.day) ? 'bg-amber-soft' : ''
            }`}>
            {c.day != null && (
              <>
                <div className="text-xs font-semibold mb-1 text-muted">{c.day}</div>
                <div className="space-y-1">
                  {(eventsByDay[c.key!] ?? []).map((e) => (
                    <Link
                      key={e.id}
                      href={`/events/${e.id}`}
                      className={`block px-2 py-1 rounded text-xs font-semibold truncate ${PILL_BG[e.status]} ${PILL_TXT[e.status]}`}
                      title={e.title}>
                      {e.title}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
