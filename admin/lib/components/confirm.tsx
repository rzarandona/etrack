'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type ConfirmOptions = {
  /** Optional bold heading. Defaults to 'Are you sure?' */
  title?: string;
  /** Body copy. */
  message: string;
  /** Confirm button label. Default: 'Confirm' (or 'Delete' when destructive). */
  confirmText?: string;
  /** Cancel button label. Default: 'Cancel'. */
  cancelText?: string;
  /** Renders the confirm button in destructive (red) styling. */
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide confirm dialog provider. Replaces native browser `confirm()`
 * with an in-app modal that matches the design system. Use via `useConfirm()`:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({ message: 'Delete X?', destructive: true });
 *   if (!ok) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState(options);
    });
  }, []);

  const handle = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  };

  // Esc to cancel, Enter to confirm.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handle(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handle(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog options={state} onResult={handle} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return ctx;
}

function ConfirmDialog({
  options,
  onResult,
}: {
  options: ConfirmOptions;
  onResult: (value: boolean) => void;
}) {
  const {
    title = 'Are you sure?',
    message,
    confirmText,
    cancelText = 'Cancel',
    destructive = false,
  } = options;

  const finalConfirmText = confirmText ?? (destructive ? 'Delete' : 'Confirm');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onClick={() => onResult(false)}
      role="dialog"
      aria-modal="true">
      <div
        className="card w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted whitespace-pre-line">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={() => onResult(false)} className="btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={() => onResult(true)}
            autoFocus
            className="btn-primary"
            style={destructive ? { background: 'var(--accent-deep)' } : undefined}>
            {finalConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
