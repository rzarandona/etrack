'use client';

import { useState, useTransition } from 'react';
import { createSite } from './actions';

export function NewSiteForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New site
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await createSite(fd);
          if (!r.ok) setError(r.error);
          else setOpen(false);
        })
      }
      className="card p-4 ring-soft min-w-[420px]">
      <h2 className="mb-3 text-base font-bold">New site</h2>
      {error && (
        <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--rose-soft)', color: 'var(--accent-deep)' }}>
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block col-span-2">
          <span className="label">Name</span>
          <input name="name" required placeholder="Main Office" className="input" />
        </label>
        <label className="block">
          <span className="label">Latitude</span>
          <input name="latitude" type="number" step="0.000001" placeholder="14.5995" className="input" />
        </label>
        <label className="block">
          <span className="label">Longitude</span>
          <input name="longitude" type="number" step="0.000001" placeholder="120.9842" className="input" />
        </label>
        <label className="block col-span-2">
          <span className="label">Geofence radius (m)</span>
          <input name="geofence_radius_m" type="number" step="1" placeholder="75" className="input" />
        </label>
      </div>
      <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
        Leave radius empty to skip geofence enforcement on the mobile app for this site.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
