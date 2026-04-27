'use client';

import { useMemo, useState, useTransition } from 'react';
import { useConfirm } from '@/lib/components/confirm';
import type { AssignmentRole } from '@/lib/types';
import { assignUser, removeAssignment, setAssignmentRate } from '../actions';

export type AssignmentRow = {
  id: string;
  user_id: string;
  role: AssignmentRole;
  pay_rate_override: string | null;
  user_full_name: string;
  employee_code: string | null;
};

export type AssignableUser = {
  id: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'employee';
  employee_code: string | null;
};

export function AssignmentPanel({
  eventId,
  assignments,
  assignableUsers,
}: {
  eventId: string;
  assignments: AssignmentRow[];
  assignableUsers: AssignableUser[];
}) {
  const supervisors = assignments.filter((a) => a.role === 'supervisor');
  const employees = assignments.filter((a) => a.role === 'employee');

  return (
    <div className="card p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold">Assignments</h2>
        <p className="text-xs text-muted">
          Supervisors run the floor; employees clock in for the phases. Pay-rate override is
          per-employee per-event; if blank, the phase&apos;s default pay rate applies.
        </p>
      </div>

      <RoleSection
        title="Supervisors"
        role="supervisor"
        eventId={eventId}
        assignments={supervisors}
        assignableUsers={assignableUsers.filter(
          (u) => (u.role === 'supervisor' || u.role === 'admin') &&
                 !assignments.some((a) => a.user_id === u.id)
        )}
      />

      <RoleSection
        title="Employees"
        role="employee"
        eventId={eventId}
        assignments={employees}
        assignableUsers={assignableUsers.filter(
          (u) => u.role === 'employee' &&
                 !assignments.some((a) => a.user_id === u.id)
        )}
      />
    </div>
  );
}

function RoleSection({
  title,
  role,
  eventId,
  assignments,
  assignableUsers,
}: {
  title: string;
  role: AssignmentRole;
  eventId: string;
  assignments: AssignmentRow[];
  assignableUsers: AssignableUser[];
}) {
  const [pickId, setPickId] = useState<string>('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    if (!pickId) return;
    start(async () => {
      setError(null);
      const r = await assignUser(eventId, pickId, role);
      if (!r.ok) setError(r.error);
      else setPickId('');
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">
          {title}{' '}
          <span className="text-muted text-xs font-medium">({assignments.length})</span>
        </h3>
      </div>

      {assignments.length === 0 ? (
        <p className="py-3 text-center text-muted text-sm rounded-lg ring-soft bg-soft">
          None assigned yet.
        </p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <AssignmentRowView key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {assignableUsers.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="input flex-1">
            <option value="">— Add {role} —</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
                {u.employee_code ? ` · ${u.employee_code}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdd}
            disabled={!pickId || pending}
            className="btn-primary">
            {pending ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-deep">{error}</p>}
    </div>
  );
}

function AssignmentRowView({ assignment }: { assignment: AssignmentRow }) {
  const confirm = useConfirm();
  const [override, setOverride] = useState<string>(assignment.pay_rate_override ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(
    () => override !== (assignment.pay_rate_override ?? ''),
    [override, assignment.pay_rate_override]
  );

  return (
    <div className="flex items-center gap-3 rounded-lg ring-soft px-3 py-2.5 bg-card">
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{assignment.user_full_name}</div>
        {assignment.employee_code && (
          <div className="text-xs text-muted">{assignment.employee_code}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          placeholder="Rate override"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          className="input w-32 text-right"
        />
        {dirty && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const n = override.trim();
                const v = n ? Number(n) : null;
                if (n && (!Number.isFinite(v) || (v as number) < 0)) {
                  setError('Invalid rate');
                  return;
                }
                const r = await setAssignmentRate(assignment.id, v);
                if (!r.ok) setError(r.error);
              })
            }
            className="btn-primary !py-1.5 !px-3 !text-xs">
            Save
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: `Remove ${assignment.user_full_name}?`,
              message: 'They will be unassigned from this event.',
              destructive: true,
              confirmText: 'Remove',
            });
            if (!ok) return;
            start(async () => {
              const r = await removeAssignment(assignment.id);
              if (!r.ok) setError(r.error);
            });
          }}
          className="btn-ghost-danger">
          Remove
        </button>
      </div>
      {error && <p className="ml-2 text-xs text-deep">{error}</p>}
    </div>
  );
}
