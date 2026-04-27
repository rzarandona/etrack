import Link from 'next/link';
import { Avatar } from '@/lib/components/avatar';
import { StatusPill } from '@/lib/components/pills';
import { signPaths } from '@/lib/storage';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Employee } from '@/lib/types';

export default async function EmployeesPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('employees')
    .select('*')
    .order('active', { ascending: false })
    .order('employee_code');
  const employees = (data as Employee[]) ?? [];

  const photoUrlByPath = await signPaths(
    supabase,
    'employee-photos',
    employees.map((e) => e.photo_url).filter((p): p is string => Boolean(p)),
    60 * 30
  );

  const activeCount = employees.filter((e) => e.active).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Employees</h1>
          <p className="text-sm mt-1 text-muted">
            {activeCount} active · {employees.length} total
          </p>
        </div>
        <Link href="/employees/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add employee
        </Link>
      </div>

      <div className="card p-5">
        {employees.length === 0 ? (
          <p className="py-10 text-center text-muted">
            No employees yet. Add one to start issuing badges.
          </p>
        ) : (
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3 pl-2" />
                  <th className="font-medium pb-3">Employee</th>
                  <th className="font-medium pb-3">Contact</th>
                  <th className="font-medium pb-3 text-right pr-6">Rate</th>
                  <th className="font-medium pb-3 pl-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const url = e.photo_url ? photoUrlByPath[e.photo_url] : null;
                  return (
                    <tr key={e.id} className="table-row border-t border-line cursor-pointer">
                      <td className="py-3 pl-2 pr-3">
                        <Link href={`/employees/${e.id}`} className="inline-block">
                          <Avatar name={e.full_name} url={url} size="lg" />
                        </Link>
                      </td>
                      <td className="py-3">
                        <Link href={`/employees/${e.id}`} className="block">
                          <div className={e.active ? 'font-bold' : 'font-bold line-through text-muted'}>
                            {e.full_name}
                          </div>
                          <div className="text-xs text-muted">{e.employee_code}</div>
                        </Link>
                      </td>
                      <td className="py-3 text-muted">
                        <Link href={`/employees/${e.id}`} className="block">
                          {e.contact_no ?? <span className="opacity-60">—</span>}
                        </Link>
                      </td>
                      <td className="py-3 text-right tabular-nums pr-6">
                        <Link href={`/employees/${e.id}`} className="block">
                          {e.hourly_rate ?? <span className="text-muted">—</span>}
                        </Link>
                      </td>
                      <td className="py-3 pl-2">
                        <Link href={`/employees/${e.id}`} className="block">
                          <StatusPill active={e.active} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
