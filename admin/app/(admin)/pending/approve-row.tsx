'use client';

import { useState, useTransition } from 'react';
import { useConfirm } from '@/lib/components/confirm';
import {
  approveAsAdmin,
  approveAsEmployee,
  approveAsSupervisor,
  rejectPending,
} from './actions';

export type UnlinkedEmployee = {
  id: string;
  full_name: string;
  employee_code: string;
};

type Props = {
  profileId: string;
  fullName: string;
  unlinked: UnlinkedEmployee[];
};

type Mode = 'idle' | 'employee';

export function ApproveRow({ profileId, fullName, unlinked }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [linkTo, setLinkTo] = useState<string>(''); // '' = create new
  const [rateText, setRateText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else setMode('idle');
    });
  };

  const onApproveEmployee = () => {
    const linkToEmployeeId = linkTo || undefined;
    const hourlyRate = rateText.trim() ? Number(rateText.trim()) : undefined;
    if (hourlyRate !== undefined && (Number.isNaN(hourlyRate) || hourlyRate < 0)) {
      setError('Hourly rate must be a non-negative number.');
      return;
    }
    run(() => approveAsEmployee(profileId, { linkToEmployeeId, hourlyRate }));
  };

  const onApproveSupervisor = () => run(() => approveAsSupervisor(profileId));

  const onApproveAdmin = async () => {
    const ok = await confirm({
      title: 'Promote to admin?',
      message: `${fullName} will get full administrative access. This is a privileged role — only approve admins you trust.`,
      confirmText: 'Promote to admin',
    });
    if (!ok) return;
    run(() => approveAsAdmin(profileId));
  };

  const onReject = async () => {
    const ok = await confirm({
      title: 'Reject signup?',
      message: `${fullName} will be deactivated and won't be able to sign in. The row is kept for audit; you can reactivate it later if needed.`,
      destructive: true,
      confirmText: 'Reject',
    });
    if (!ok) return;
    run(() => rejectPending(profileId));
  };

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <button
          className="btn-primary text-xs px-3 py-1.5"
          onClick={() => setMode('employee')}
          disabled={pending}>
          Employee
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={onApproveSupervisor}
          disabled={pending}>
          Supervisor
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={onApproveAdmin}
          disabled={pending}>
          Admin
        </button>
        <button
          className="btn-ghost-danger text-xs px-3 py-1.5"
          onClick={onReject}
          disabled={pending}>
          Reject
        </button>
        {error && <div className="w-full text-xs text-right" style={{ color: 'var(--accent-deep)' }}>{error}</div>}
      </div>
    );
  }

  // Employee approval form: link to existing or create new.
  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <select
          className="input text-xs py-1.5 max-w-[220px]"
          value={linkTo}
          onChange={(e) => setLinkTo(e.target.value)}
          disabled={pending}>
          <option value="">— create new employee record —</option>
          {unlinked.map((u) => (
            <option key={u.id} value={u.id}>
              {u.employee_code} · {u.full_name}
            </option>
          ))}
        </select>
        {!linkTo && (
          <input
            className="input text-xs py-1.5 w-28"
            placeholder="Hourly rate"
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value)}
            disabled={pending}
          />
        )}
        <button
          className="btn-primary text-xs px-3 py-1.5"
          onClick={onApproveEmployee}
          disabled={pending}>
          {pending ? 'Saving…' : 'Confirm'}
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={() => {
            setMode('idle');
            setLinkTo('');
            setRateText('');
            setError(null);
          }}
          disabled={pending}>
          Cancel
        </button>
      </div>
      {error && <div className="text-xs" style={{ color: 'var(--accent-deep)' }}>{error}</div>}
    </div>
  );
}
