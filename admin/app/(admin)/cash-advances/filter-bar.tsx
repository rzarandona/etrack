'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

type EmployeeOption = { id: string; full_name: string; employee_code: string };

export function FilterBar({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [user, setUser] = useState(params.get('user') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (user) next.set('user', user);
    if (status) next.set('status', status);
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };

  const reset = () => {
    setUser('');
    setStatus('');
    start(() => router.replace(pathname));
  };

  return (
    <form
      onSubmit={apply}
      className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-6">
        <span className="label">Employee</span>
        <select value={user} onChange={(e) => setUser(e.target.value)} className="input">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employee_code} · {e.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <span className="label">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="applied">Applied</option>
          <option value="deferred">Deferred</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="md:col-span-3 flex items-center justify-end gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Applying…' : 'Apply'}
        </button>
        <button type="button" onClick={reset} disabled={pending} className="btn-secondary">
          Reset
        </button>
      </div>
    </form>
  );
}
