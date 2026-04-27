'use client';

import { useState, useTransition } from 'react';
import { createRate } from './actions';

export function NewRateForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New rate
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await createRate(fd);
          if (!r.ok) setError(r.error);
          else setOpen(false);
        })
      }
      className="card p-4 ring-soft min-w-[300px]">
      <h2 className="mb-3 text-base font-bold">New rate</h2>
      {error && (
        <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--rose-soft)', color: 'var(--accent-deep)' }}>
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Label</span>
          <input name="label" placeholder="Standard" required className="input" />
        </label>
        <label className="block">
          <span className="label">Hourly rate</span>
          <input name="hourly_rate" type="number" step="0.01" required className="input" />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save rate'}
        </button>
      </div>
    </form>
  );
}
