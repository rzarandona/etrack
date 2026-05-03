'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Violation, ViolationSeverity } from '@/lib/types';
import { createViolation, updateViolation } from './actions';

export type EmployeeOption = { id: string; full_name: string; employee_code: string };
export type EventOption = {
  id: string;
  title: string;
  starts_at: string;
  phases: { id: string; name: string; ord: number }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  events: EventOption[];
  initial?: Violation;
};

const SEVERITIES: { value: ViolationSeverity; label: string }[] = [
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
];

export function ViolationForm({ open, onClose, employees, events, initial }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [employeeId, setEmployeeId] = useState(initial?.employee_id ?? '');
  const [eventId, setEventId] = useState(initial?.event_id ?? '');
  const [phaseId, setPhaseId] = useState(initial?.phase_id ?? '');
  const [severity, setSeverity] = useState<ViolationSeverity>(initial?.severity ?? 'minor');
  const [description, setDescription] = useState(initial?.description ?? '');

  const phases = useMemo(() => {
    if (!eventId) return [];
    const ev = events.find((e) => e.id === eventId);
    return ev?.phases ?? [];
  }, [eventId, events]);

  if (!open) return null;

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('employee_id', employeeId);
    fd.set('severity', severity);
    fd.set('description', description);
    if (eventId) fd.set('event_id', eventId);
    if (phaseId) fd.set('phase_id', phaseId);
    startTransition(async () => {
      const r = initial ? await updateViolation(initial.id, fd) : await createViolation(fd);
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
        <h3 className="text-lg font-bold">{initial ? 'Edit violation' : 'Report violation'}</h3>

        <div>
          <span className="label">Employee</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
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
            <span className="label">Severity</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as ViolationSeverity)}
              className="input"
              disabled={pending}>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Event (optional)</span>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setPhaseId('');
              }}
              className="input"
              disabled={pending}>
              <option value="">—</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} · {new Date(ev.starts_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {eventId && phases.length > 0 && (
          <div>
            <span className="label">Phase (optional)</span>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              className="input"
              disabled={pending}>
              <option value="">— any phase —</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <span className="label">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            rows={3}
            disabled={pending}
            placeholder="What happened? Be specific so the employee and admin can follow up."
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
            {pending ? 'Saving…' : initial ? 'Save' : 'Report'}
          </button>
        </div>
      </form>
    </div>
  );
}
