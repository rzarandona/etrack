'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export type EventOption = { id: string; title: string };

type Props = {
  events: EventOption[];
};

export function FilterBar({ events }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [type, setType] = useState(params.get('type') ?? '');
  const [eventId, setEventId] = useState(params.get('event') ?? '');
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [mock, setMock] = useState(params.get('mock') === '1');

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (type) next.set('type', type);
    if (eventId) next.set('event', eventId);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    if (mock) next.set('mock', '1');
    const qs = next.toString();
    start(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const clear = () => {
    setQ('');
    setType('');
    setEventId('');
    setFrom('');
    setTo('');
    setMock(false);
    start(() => {
      router.replace(pathname);
    });
  };

  return (
    <form
      onSubmit={apply}
      className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-4">
        <span className="label">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or employee code…"
          className="input"
        />
      </div>
      <div className="md:col-span-2">
        <span className="label">Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className="input">
          <option value="">All</option>
          <option value="in">In</option>
          <option value="out">Out</option>
        </select>
      </div>
      <div className="md:col-span-3">
        <span className="label">Event</span>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="input">
          <option value="">Any</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </label>
      </div>

      <label className="md:col-span-4 inline-flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={mock}
          onChange={(e) => setMock(e.target.checked)}
          className="h-4 w-4 rounded"
          style={{ accentColor: 'var(--accent)' }}
        />
        Only mock-location flagged
      </label>

      <div className="md:col-span-8 flex items-center justify-end gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Applying…' : 'Apply filters'}
        </button>
        <button type="button" onClick={clear} disabled={pending} className="btn-secondary">
          Reset
        </button>
      </div>
    </form>
  );
}
