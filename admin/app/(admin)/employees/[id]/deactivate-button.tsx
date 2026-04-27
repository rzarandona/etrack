'use client';

import { useTransition } from 'react';
import { setEmployeeActive } from '../actions';

export function DeactivateButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await setEmployeeActive(id, !active);
        })
      }
      disabled={pending}
      className="btn-secondary"
      style={
        active
          ? { color: 'var(--accent-deep)' }
          : { color: '#1F8E58' }
      }>
      {pending ? '…' : active ? 'Deactivate' : 'Reactivate'}
    </button>
  );
}
