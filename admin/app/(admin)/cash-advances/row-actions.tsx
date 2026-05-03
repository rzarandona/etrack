'use client';

import { useState, useTransition } from 'react';
import { useConfirm } from '@/lib/components/confirm';
import type { CashAdvance } from '@/lib/types';
import { deleteAdvance, setAdvanceStatus } from './actions';
import { AdvanceForm, type EmployeeOption, type EventOption } from './advance-form';

export function RowActions({
  advance,
  employees,
  events,
}: {
  advance: CashAdvance;
  employees: EmployeeOption[];
  events: EventOption[];
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedEventId, setAppliedEventId] = useState(advance.applied_event_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        setApplying(false);
      }
    });
  };

  const onApplyConfirm = () => {
    if (!appliedEventId) {
      setError('Pick an event.');
      return;
    }
    run(() => setAdvanceStatus(advance.id, 'applied', appliedEventId));
  };

  const onDefer = () => run(() => setAdvanceStatus(advance.id, 'deferred'));

  const onCancelStatus = async () => {
    const ok = await confirm({
      title: 'Cancel this advance?',
      message: 'Marks the advance as cancelled (e.g. recorded by mistake). The row stays for audit.',
      confirmText: 'Mark cancelled',
    });
    if (!ok) return;
    run(() => setAdvanceStatus(advance.id, 'cancelled'));
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete advance?',
      message: 'This permanently removes the advance record. Use only for true data-entry mistakes — for everyday cancellations use "Cancel" so the audit trail stays.',
      destructive: true,
    });
    if (!ok) return;
    run(() => deleteAdvance(advance.id));
  };

  if (applying) {
    return (
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <select
          className="input text-xs py-1.5 max-w-[220px]"
          value={appliedEventId}
          onChange={(e) => setAppliedEventId(e.target.value)}
          disabled={pending}>
          <option value="">— event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} · {new Date(ev.starts_at).toLocaleDateString()}
            </option>
          ))}
        </select>
        <button className="btn-primary text-xs px-3 py-1.5" onClick={onApplyConfirm} disabled={pending}>
          {pending ? 'Saving…' : 'Confirm'}
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={() => {
            setApplying(false);
            setError(null);
          }}
          disabled={pending}>
          Cancel
        </button>
        {error && <div className="w-full text-xs text-right" style={{ color: 'var(--accent-deep)' }}>{error}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {advance.status === 'pending' && (
          <button
            className="btn-primary text-xs px-3 py-1.5"
            onClick={() => setApplying(true)}
            disabled={pending}>
            Apply…
          </button>
        )}
        {(advance.status === 'pending' || advance.status === 'applied') && (
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            onClick={onDefer}
            disabled={pending}>
            Defer
          </button>
        )}
        {advance.status !== 'cancelled' && (
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            onClick={onCancelStatus}
            disabled={pending}>
            Cancel
          </button>
        )}
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={() => setEditing(true)}
          disabled={pending}>
          Edit
        </button>
        <button
          className="btn-ghost-danger text-xs px-3 py-1.5"
          onClick={onDelete}
          disabled={pending}>
          Delete
        </button>
        {error && <div className="w-full text-xs text-right" style={{ color: 'var(--accent-deep)' }}>{error}</div>}
      </div>

      <AdvanceForm
        open={editing}
        onClose={() => setEditing(false)}
        employees={employees}
        events={events}
        initial={advance}
      />
    </>
  );
}
