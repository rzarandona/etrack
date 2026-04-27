'use client';

import { useTransition } from 'react';
import { setSiteActive } from './actions';

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => void (await setSiteActive(id, !active)))}
      disabled={pending}
      className="btn-ghost-danger"
      style={!active ? { color: '#1F8E58' } : undefined}>
      {active ? 'Deactivate' : 'Reactivate'}
    </button>
  );
}
