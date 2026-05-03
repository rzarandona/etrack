'use client';

import { useState, useTransition } from 'react';
import type { CashAdvance, CashAdvanceStatus } from '@/lib/types';
import { createAdvance, updateAdvance } from './actions';

export type EmployeeOption = { id: string; full_name: string; employee_code: string };
export type EventOption = { id: string; title: string; starts_at: string };

type Props = {
  open: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  events: EventOption[];
  /** When set, the form is in edit mode for this advance. */
  initial?: CashAdvance;
};

const STATUSES: { value: CashAdvanceStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied to event' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'cancelled', label: 'Cancelled' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdvanceForm({ open, onClose, employees, events, initial }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [userId, setUserId] = useState(initial?.user_id ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.advance_date ?? todayISO());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<CashAdvanceStatus>(initial?.status ?? 'pending');
  const [appliedEventId, setAppliedEventId] = useState(initial?.applied_event_id ?? '');

  if (!open) return null;

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('user_id', userId);
    fd.set('amount', amount);
    fd.set('advance_date', date);
    fd.set('notes', notes);
    fd.set('status', status);
    if (status === 'applied') fd.set('applied_event_id', appliedEventId);
    startTransition(async () => {
      const r = initial ? await updateAdvance(initial.id, fd) : await createAdvance(fd);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handle}
        className="card w-full max-w-lg p-6 shadow-2xl flex flex-col gap-3">
        <h3 className="text-lg font-bold">{initial ? 'Edit advance' : 'Record advance'}</h3>

        <div>
          <span className="label">Employee</span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input"
            disabled={pending}>
            <option value="">— select —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} · {emp.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Amount (PHP)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              disabled={pending}
            />
          </div>
          <div>
            <span className="label">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              disabled={pending}
            />
          </div>
        </div>

        <div>
          <span className="label">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CashAdvanceStatus)}
            className="input"
            disabled={pending}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {status === 'applied' && (
          <div>
            <span className="label">Applied to event</span>
            <select
              value={appliedEventId}
              onChange={(e) => setAppliedEventId(e.target.value)}
              className="input"
              disabled={pending}>
              <option value="">— select event —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} · {new Date(ev.starts_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <span className="label">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            rows={2}
            disabled={pending}
          />
        </div>

        {error && (
          <div className="text-sm" style={{ color: 'var(--accent-deep)' }}>
            {error}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Saving…' : initial ? 'Save' : 'Record'}
          </button>
        </div>
      </form>
    </div>
  );
}
