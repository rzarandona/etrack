'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useConfirm } from '@/lib/components/confirm';
import type { BadgeStatus, Employee } from '@/lib/types';
import { deleteBadges } from './actions';

type EmployeePick = Pick<Employee, 'id' | 'employee_code' | 'full_name' | 'active'>;

export function BadgeExportForm({
  employees,
  qrUrlByEmployeeId,
  statusByEmployeeId,
}: {
  employees: EmployeePick[];
  qrUrlByEmployeeId: Record<string, string | null>;
  statusByEmployeeId: Record<string, BadgeStatus>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(f) || e.employee_code.toLowerCase().includes(f)
    );
  }, [employees, filter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((e) => next.add(e.id));
      return next;
    });
  };
  const clearAll = () => setSelected(new Set());

  const exportZip = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/badges/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = /filename="([^"]+)"/.exec(cd);
      a.download = m?.[1] ?? 'etrack-badges.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or code…"
          className="input flex-1"
        />
        <button onClick={selectAllVisible} className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          Select all visible
        </button>
        <button onClick={clearAll} className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
          Clear
        </button>
      </div>

      <div className="rounded-xl ring-soft overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-center" style={{ color: 'var(--muted)' }}>No matching employees.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {filtered.map((e, idx) => {
              const qrUrl = qrUrlByEmployeeId[e.id] ?? null;
              const badgeStatus = statusByEmployeeId[e.id];
              return (
                <li
                  key={e.id}
                  className={`px-4 py-3 table-row ${idx > 0 ? 'border-t' : ''}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 56px 1fr auto auto',
                    alignItems: 'center',
                    gap: '16px',
                    borderColor: 'var(--line)',
                  }}>
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div
                    className="h-14 w-14 rounded-md ring-soft flex items-center justify-center bg-white"
                    title={qrUrl ? `QR: ${e.employee_code}` : 'QR not generated yet'}>
                    {qrUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrUrl}
                        alt={`QR for ${e.employee_code}`}
                        loading="lazy"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-[9px]" style={{ color: 'var(--muted)' }}>
                        No QR
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={e.active ? 'font-bold truncate' : 'truncate'}
                      style={{
                        fontSize: '0.8em',
                        ...(e.active
                          ? null
                          : { color: 'var(--muted)', textDecoration: 'line-through' }),
                      }}>
                      {e.full_name}
                    </div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {e.employee_code}
                    </div>
                  </div>
                  <div>
                    {badgeStatus === 'active' && (
                      <span className="pill status-active">● Active</span>
                    )}
                    {badgeStatus === 'deleted' && (
                      <span className="pill status-pending">● Deleted</span>
                    )}
                    {!badgeStatus && (
                      <span className="pill status-inactive">Not generated</span>
                    )}
                  </div>
                  <div>
                    {!e.active && <span className="pill status-inactive">Inactive</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--rose-soft)', color: 'var(--accent-deep)' }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {selected.size} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (selected.size === 0) return;
              const ok = await confirm({
                title: `Delete ${selected.size} badge${selected.size === 1 ? '' : 's'}?`,
                message:
                  'The QR PNG files will be removed from storage. Employee records are kept; saving an employee regenerates their badge.',
                destructive: true,
              });
              if (!ok) return;
              startDelete(async () => {
                setError(null);
                const r = await deleteBadges(Array.from(selected));
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setSelected(new Set());
                router.refresh();
              });
            }}
            disabled={busy || deleting || selected.size === 0}
            className="btn-secondary"
            style={{ color: 'var(--accent-deep)' }}>
            {deleting ? 'Deleting…' : `Delete ${selected.size} badge${selected.size === 1 ? '' : 's'}`}
          </button>
          <button
            onClick={exportZip}
            disabled={busy || deleting || selected.size === 0}
            className="btn-primary">
            {busy ? 'Building ZIP…' : `Export ${selected.size} badge${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
