'use client';

import { useState, useTransition } from 'react';
import { StatusPill } from '@/lib/components/pills';
import type { Rate } from '@/lib/types';
import { setRateActive, updateRate } from './actions';

export function RateRow({ rate }: { rate: Rate }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <tr className="table-row border-t border-line">
      <td className="py-3">
        {editing ? (
          <input id={`label-${rate.id}`} defaultValue={rate.label} className="input" />
        ) : (
          <span
            className={rate.active ? 'font-bold' : 'line-through text-muted'}>
            {rate.label}
          </span>
        )}
      </td>
      <td className="py-3 text-right pr-6">
        {editing ? (
          <input
            id={`rate-${rate.id}`}
            type="number"
            step="0.01"
            defaultValue={rate.hourly_rate}
            className="input w-32 text-right"
          />
        ) : (
          <span className="tabular-nums font-semibold">{rate.hourly_rate}</span>
        )}
      </td>
      <td className="py-3 pl-2">
        <StatusPill active={rate.active} />
      </td>
      <td className="py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} disabled={pending} className="btn-secondary !py-1.5 !px-3 !text-xs">
              Cancel
            </button>
            <button
              onClick={() => {
                const fd = new FormData();
                fd.set('label', (document.getElementById(`label-${rate.id}`) as HTMLInputElement).value);
                fd.set('hourly_rate', (document.getElementById(`rate-${rate.id}`) as HTMLInputElement).value);
                start(async () => {
                  setError(null);
                  const r = await updateRate(rate.id, fd);
                  if (!r.ok) setError(r.error);
                  else setEditing(false);
                });
              }}
              disabled={pending}
              className="btn-primary !py-1.5 !px-3 !text-xs">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-stone-100">
              Edit
            </button>
            <button
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await setRateActive(rate.id, !rate.active);
                  if (!r.ok) setError(r.error);
                })
              }
              disabled={pending}
              className="btn-ghost-danger"
              style={!rate.active ? { color: '#1F8E58' } : undefined}>
              {rate.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-deep">{error}</p>}
      </td>
    </tr>
  );
}
