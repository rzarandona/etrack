import Link from 'next/link';
import { notFound } from 'next/navigation';
import { signEmployeePhoto } from '@/lib/badge';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Employee, Rate } from '@/lib/types';
import { EmployeeForm } from '../../employee-form';

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [{ data: employee }, { data: rates }] = await Promise.all([
    supabase.from('employees').select('*').eq('id', id).single(),
    supabase.from('rates').select('*').eq('active', true).order('hourly_rate', { ascending: false }),
  ]);

  if (!employee) notFound();
  const emp = employee as Employee;

  const photoUrl = emp.photo_url ? await signEmployeePhoto(supabase, emp.photo_url) : null;

  return (
    <div>
      <div className="mb-5">
        <Link href={`/employees/${emp.id}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--muted)' }}>
          ← {emp.full_name}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Edit employee</h1>
        <p className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
          {emp.employee_code}
        </p>
      </div>
      <EmployeeForm rates={(rates as Rate[]) ?? []} employee={emp} photoUrl={photoUrl} />
    </div>
  );
}
