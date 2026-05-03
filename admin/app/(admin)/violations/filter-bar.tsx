'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

type EmployeeOption = { id: string; full_name: string; employee_code: string };

export function FilterBar({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [emp, setEmp] = useState(params.get('employee') ?? '');
  const [severity, setSeverity] = useState(params.get('severity') ?? '');
  const [resolved, setResolved] = useState(params.get('resolved') ?? '');

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (emp) next.set('employee', emp);
    if (severity) next.set('severity', severity);
    if (resolved) next.set('resolved', resolved);
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };

  const reset = () => {
    setEmp('');
    setSeverity('');
    setResolved('');
    start(() => router.replace(pathname));
  };

  return (
    <form
      onSubmit={apply}
      className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-5">
        <span className="label">Employee</span>
        <select value={emp} onChange={(e) => setEmp(e.target.value)} className="input">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employee_code} · {e.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <span className="label">Severity</span>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input">
          <option value="">All</option>
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <span className="label">Status</span>
        <select value={resolved} onChange={(e) => setResolved(e.target.value)} className="input">
          <option value="">All</option>
          <option value="false">Open</option>
          <option value="true">Resolved</option>
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
