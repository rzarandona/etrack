import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Rate } from '@/lib/types';
import { EmployeeForm } from '../employee-form';

export default async function NewEmployeePage() {
  const supabase = await getSupabaseServer();
  const { data: rates } = await supabase
    .from('rates')
    .select('*')
    .eq('active', true)
    .order('hourly_rate', { ascending: false });

  return (
    <div>
      <div className="mb-5">
        <Link href="/employees" className="text-sm font-semibold hover:underline" style={{ color: 'var(--muted)' }}>
          ← Employees
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">New employee</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          The employee code and QR badge are generated automatically when you save.
        </p>
      </div>
      <EmployeeForm rates={(rates as Rate[]) ?? []} />
    </div>
  );
}
