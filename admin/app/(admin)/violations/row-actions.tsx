'use client';

import { useState, useTransition } from 'react';
import { useConfirm } from '@/lib/components/confirm';
import type { Violation } from '@/lib/types';
import { deleteViolation, setResolved } from './actions';
import { ViolationForm, type EmployeeOption, type EventOption } from './violation-form';

export function RowActions({
  violation,
  employees,
  events,
}: {
  violation: Violation;
  employees: EmployeeOption[];
  events: EventOption[];
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  };

  const onToggleResolve = () => run(() => setResolved(violation.id, !violation.resolved));

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete violation?',
      message: 'Permanently removes the violation record. Use only for true data-entry mistakes.',
      destructive: true,
    });
    if (!ok) return;
    run(() => deleteViolation(violation.id));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <button
          className={violation.resolved ? 'btn-secondary text-xs px-3 py-1.5' : 'btn-primary text-xs px-3 py-1.5'}
          onClick={onToggleResolve}
          disabled={pending}>
          {violation.resolved ? 'Reopen' : 'Resolve'}
        </button>
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
        {error && (
          <div className="w-full text-xs text-right" style={{ color: 'var(--accent-deep)' }}>
            {error}
          </div>
        )}
      </div>

      <ViolationForm
        open={editing}
        onClose={() => setEditing(false)}
        employees={employees}
        events={events}
        initial={violation}
      />
    </>
  );
}
