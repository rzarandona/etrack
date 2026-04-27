'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (status) next.set('status', status);
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };

  const reset = () => {
    setQ('');
    setStatus('');
    start(() => router.replace(pathname));
  };

  return (
    <form
      onSubmit={apply}
      className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-7">
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
        <span className="label">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="md:col-span-3 flex items-center justify-end gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Applying…' : 'Apply filters'}
        </button>
        <button type="button" onClick={reset} disabled={pending} className="btn-secondary">
          Reset
        </button>
      </div>
    </form>
  );
}
