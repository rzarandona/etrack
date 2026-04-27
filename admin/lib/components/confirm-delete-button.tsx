'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useConfirm } from './confirm';

type Result = { ok: true } | { ok: false; error: string };

type Props = {
  /** Modal title — usually `Delete "{name}"?` */
  title: string;
  /** Modal body explaining cascade / loss / fallbacks. */
  message: string;
  /** Button label. Defaults to 'Delete'. */
  label?: string;
  /** Confirm-button label. Defaults to 'Delete'. */
  confirmText?: string;
  /** Called after the user confirms. Should return ok or an error to surface. */
  onDelete: () => Promise<Result>;
  /** If provided, navigate here on success. */
  redirectTo?: string;
};

/**
 * Single-row destructive button with a confirm modal. Replaces per-page
 * DeleteFooButton boilerplate. Errors from `onDelete` are rendered inline
 * next to the button so the user sees blocked-by-FK / permission messages
 * without a popup.
 */
export function ConfirmDeleteButton({
  title,
  message,
  label = 'Delete',
  confirmText,
  onDelete,
  redirectTo,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    const ok = await confirm({ title, message, destructive: true, confirmText });
    if (!ok) return;
    start(async () => {
      setError(null);
      const r = await onDelete();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={onClick}
        disabled={pending}
        className="btn-secondary"
        style={{ color: 'var(--accent-deep)' }}>
        {pending ? 'Deleting…' : label}
      </button>
      {error && <span className="text-xs text-deep ml-2">{error}</span>}
    </>
  );
}
