'use client';

import { ConfirmDeleteButton } from '@/lib/components/confirm-delete-button';
import { deleteEvent } from '../actions';

export function DeleteEventButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmDeleteButton
      title={`Delete ${title}?`}
      message="This permanently removes the event, its phases, assignments, and any scans tied to it. This cannot be undone."
      onDelete={async () => {
        const r = await deleteEvent(id);
        return r.ok ? { ok: true } : r;
      }}
      redirectTo="/events"
    />
  );
}
