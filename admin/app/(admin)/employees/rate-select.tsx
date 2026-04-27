'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createRate } from '../rates/actions';
import type { Rate } from '@/lib/types';

const ADD_NEW = '__ADD_NEW__';

type Props = {
  rates: Rate[];
  initialValue?: string | null;
};

export function RateSelect({ rates, initialValue }: Props) {
  const router = useRouter();
  const activeRates = rates.filter((r) => r.active);

  const initialId =
    initialValue != null
      ? activeRates.find((r) => String(r.hourly_rate) === String(initialValue))?.id ?? ''
      : '';

  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pendingNewLabel, setPendingNewLabel] = useState<string | null>(null);

  const labelRef = useRef<HTMLInputElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);

  const selectedRate = activeRates.find((r) => r.id === selectedId);
  const submittedRate =
    selectedRate?.hourly_rate ??
    (initialValue != null && !selectedId ? String(initialValue) : '');

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === ADD_NEW) {
      setCreating(true);
      return;
    }
    setSelectedId(e.target.value);
  };

  const saveNewRate = () => {
    const label = labelRef.current?.value.trim() ?? '';
    const amount = amountRef.current?.value.trim() ?? '';
    if (!label) {
      setError('Label is required.');
      return;
    }
    if (!amount || !Number.isFinite(Number(amount))) {
      setError('Hourly rate must be a number.');
      return;
    }

    const fd = new FormData();
    fd.set('label', label);
    fd.set('hourly_rate', amount);

    setPendingNewLabel(label);
    start(async () => {
      setError(null);
      const r = await createRate(fd);
      if (!r.ok) {
        setError(r.error);
        setPendingNewLabel(null);
        return;
      }
      router.refresh();
      setCreating(false);
    });
  };

  useEffect(() => {
    if (!pendingNewLabel || selectedId) return;
    const fresh = activeRates.find((r) => r.label === pendingNewLabel);
    if (fresh) {
      setSelectedId(fresh.id);
      setPendingNewLabel(null);
    }
  }, [pendingNewLabel, selectedId, activeRates]);

  return (
    <div>
      <span className="label">Hourly rate</span>

      <input type="hidden" name="hourly_rate" value={submittedRate} />

      {!creating ? (
        <select value={selectedId} onChange={onChange} className="input">
          <option value="">— Select a rate —</option>
          {activeRates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} · {r.hourly_rate}
            </option>
          ))}
          <option value={ADD_NEW}>+ Add new rate…</option>
        </select>
      ) : (
        <div className="rounded-xl ring-soft p-3" style={{ background: 'var(--hover-soft)' }}>
          <div className="grid grid-cols-2 gap-2">
            <input ref={labelRef} placeholder="Label (e.g. Standard)" className="input" />
            <input ref={amountRef} type="number" step="0.01" placeholder="Hourly rate" className="input" />
            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                disabled={pending}
                className="btn-secondary !py-1.5 !px-3 !text-xs">
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNewRate}
                disabled={pending}
                className="btn-primary !py-1.5 !px-3 !text-xs">
                {pending ? 'Saving…' : 'Save rate'}
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent-deep)' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
