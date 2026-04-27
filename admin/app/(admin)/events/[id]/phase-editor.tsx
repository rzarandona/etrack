'use client';

import { useRef, useState, useTransition } from 'react';
import { useConfirm } from '@/lib/components/confirm';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { EventPhase } from '@/lib/types';
import { addPhase, removePhase, updatePhase } from '../actions';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PhaseEditor({
  eventId,
  phases,
}: {
  eventId: string;
  phases: EventPhase[];
}) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold">Phases</h2>
        <p className="text-xs text-muted">
          The pay rate here is the per-employee default for the phase. Individual overrides go in the
          assignments panel below.
        </p>
      </div>

      {phases.length === 0 ? (
        <p className="py-4 text-center text-muted">No phases yet — add one below.</p>
      ) : (
        <div className="space-y-2">
          {phases.map((p) => (
            <PhaseRow key={p.id} phase={p} />
          ))}
        </div>
      )}

      <NewPhaseForm eventId={eventId} />
    </div>
  );
}

function PhaseRow({ phase }: { phase: EventPhase }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-lg ring-soft px-3 py-2.5 bg-card">
        <span className="w-6 h-6 rounded-full bg-soft text-xs font-bold flex items-center justify-center text-muted">
          {phase.ord}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{phase.name}</div>
          <div className="text-xs text-muted">
            {phase.starts_at ? formatDateTime(phase.starts_at) : '—'} →{' '}
            {phase.ends_at ? formatDateTime(phase.ends_at) : '—'}
            {phase.pay_rate && (
              <span className="ml-2 font-semibold text-ink">
                · {formatMoney(phase.pay_rate)}/phase
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-stone-100">
          Edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: `Remove phase "${phase.name}"?`,
              message: 'The phase will be deleted from this event.',
              destructive: true,
              confirmText: 'Remove',
            });
            if (!ok) return;
            start(async () => {
              const r = await removePhase(phase.id);
              if (!r.ok) setError(r.error);
            });
          }}
          className="btn-ghost-danger">
          Remove
        </button>
        {error && <p className="ml-2 text-xs text-deep">{error}</p>}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await updatePhase(phase.id, fd);
          if (!r.ok) setError(r.error);
          else setEditing(false);
        })
      }
      className="rounded-lg ring-soft p-3 bg-soft space-y-3">
      {error && <div className="rounded px-2 py-1 text-xs bg-rose-soft text-deep">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="block md:col-span-2">
          <span className="label">Name</span>
          <input name="name" defaultValue={phase.name} required className="input" />
        </label>
        <label className="block">
          <span className="label">Pay rate</span>
          <input
            name="pay_rate"
            type="number"
            step="0.01"
            defaultValue={phase.pay_rate ?? ''}
            className="input"
          />
        </label>
        <label className="block">
          <span className="label">Starts</span>
          <input
            name="starts_at"
            type="datetime-local"
            defaultValue={toLocalInput(phase.starts_at)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="label">Ends</span>
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={toLocalInput(phase.ends_at)}
            className="input"
          />
        </label>
        <label className="block md:col-span-3">
          <span className="label">Notes</span>
          <input name="notes" defaultValue={phase.notes ?? ''} className="input" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-secondary !py-1.5 !px-3 !text-xs">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary !py-1.5 !px-3 !text-xs">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function NewPhaseForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary w-full justify-center">
        + Add phase
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await addPhase(eventId, fd);
          if (!r.ok) setError(r.error);
          else setOpen(false);
        })
      }
      className="rounded-lg ring-soft p-3 bg-soft space-y-3">
      {error && <div className="rounded px-2 py-1 text-xs bg-rose-soft text-deep">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="block md:col-span-2">
          <span className="label">Name</span>
          <input name="name" required placeholder="Sound check" className="input" />
        </label>
        <label className="block">
          <span className="label">Pay rate</span>
          <input name="pay_rate" type="number" step="0.01" className="input" />
        </label>
        <label className="block">
          <span className="label">Starts</span>
          <input name="starts_at" type="datetime-local" className="input" />
        </label>
        <label className="block">
          <span className="label">Ends</span>
          <input name="ends_at" type="datetime-local" className="input" />
        </label>
        <label className="block md:col-span-3">
          <span className="label">Notes</span>
          <input name="notes" className="input" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-1.5 !px-3 !text-xs">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary !py-1.5 !px-3 !text-xs">
          {pending ? 'Adding…' : 'Add phase'}
        </button>
      </div>
    </form>
  );
}
