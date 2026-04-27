import Link from 'next/link';
import { notFound } from 'next/navigation';
import { signEmployeePhoto } from '@/lib/badge';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Employee } from '@/lib/types';
import { DeactivateButton } from './deactivate-button';

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data } = await supabase.from('employees').select('*').eq('id', id).single();
  if (!data) notFound();
  const emp = data as Employee;

  const [photoUrl, qrUrl] = await Promise.all([
    emp.photo_url ? signEmployeePhoto(supabase, emp.photo_url) : Promise.resolve(null),
    emp.qr_badge_url ? signEmployeePhoto(supabase, emp.qr_badge_url) : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link href="/employees" className="text-sm font-semibold hover:underline" style={{ color: 'var(--muted)' }}>
            ← Employees
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{emp.full_name}</h1>
          <p className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {emp.employee_code}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/employees/${emp.id}/edit`} className="btn-primary">
            Edit
          </Link>
          <DeactivateButton id={emp.id} active={emp.active} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <section className="card p-5 lg:col-span-3 lg:order-1">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Details
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <Detail label="Status">
              <span className={emp.active ? 'pill status-active' : 'pill status-inactive'}>
                ● {emp.active ? 'Active' : 'Inactive'}
              </span>
            </Detail>
            <Detail label="Hourly rate">
              {emp.hourly_rate ?? <span style={{ color: 'var(--muted)' }}>—</span>}
            </Detail>
            <Detail label="Birthdate">
              {emp.birthdate ?? <span style={{ color: 'var(--muted)' }}>—</span>}
            </Detail>
            <Detail label="Contact">
              {emp.contact_no ?? <span style={{ color: 'var(--muted)' }}>—</span>}
            </Detail>
            <Detail label="Home address" full>
              {emp.home_address ?? <span style={{ color: 'var(--muted)' }}>—</span>}
              {emp.home_latitude && emp.home_longitude && (
                <span className="ml-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  ({emp.home_latitude}, {emp.home_longitude})
                </span>
              )}
            </Detail>
            <Detail label="Emergency contact">
              {emp.emergency_contact_name ?? <span style={{ color: 'var(--muted)' }}>—</span>}
            </Detail>
            <Detail label="Emergency number">
              {emp.emergency_contact_number ?? <span style={{ color: 'var(--muted)' }}>—</span>}
            </Detail>
          </dl>
        </section>

        <div className="lg:col-span-2 lg:order-2">
          <div className="card p-6 rounded-lg flex flex-col items-center gap-3 lg:sticky lg:top-6">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              ID Card Preview
            </span>
            <IdCard employee={emp} photoUrl={photoUrl} qrUrl={qrUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

function IdCard({
  employee,
  photoUrl,
  qrUrl,
}: {
  employee: Employee;
  photoUrl: string | null;
  qrUrl: string | null;
}) {
  return (
    <div className="bg-white rounded-lg overflow-hidden ring-soft w-full max-w-[360px] shadow-md">
      <div
        className="flex items-center justify-between px-4 py-2.5 diag-pattern"
        style={{ background: 'var(--accent)' }}>
        <span className="text-sm font-extrabold uppercase tracking-widest text-white">etrack</span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Employee ID
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="col-span-1">
          <div className="aspect-square overflow-hidden rounded-xl" style={{ background: 'var(--hover-soft)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={employee.full_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>
                No photo
              </div>
            )}
          </div>
        </div>
        <div className="col-span-2 min-w-0">
          <div className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
            {employee.employee_code}
          </div>
          <div className="mt-1 text-base font-extrabold leading-tight break-words">
            {employee.full_name}
          </div>
          <dl className="mt-3 space-y-1 text-xs" style={{ color: 'var(--ink)' }}>
            {employee.birthdate && (
              <Field label="DOB" value={employee.birthdate} />
            )}
            {employee.contact_no && (
              <Field label="Phone" value={employee.contact_no} mono />
            )}
            {employee.hourly_rate && (
              <Field label="Rate" value={`${employee.hourly_rate}/hr`} />
            )}
          </dl>
        </div>
      </div>

      <div
        className="flex items-end justify-between gap-3 border-t px-4 py-3"
        style={{ borderColor: 'var(--line)', background: 'var(--hover-soft)' }}>
        <div className="min-w-0 flex-1 text-[10px] leading-snug" style={{ color: 'var(--ink)' }}>
          {employee.home_address && (
            <p className="break-words">
              <span style={{ color: 'var(--muted)' }}>Address: </span>
              {employee.home_address}
            </p>
          )}
          {employee.emergency_contact_name && (
            <p className="mt-1 break-words">
              <span style={{ color: 'var(--muted)' }}>In emergency: </span>
              {employee.emergency_contact_name}
              {employee.emergency_contact_number && ` · ${employee.emergency_contact_number}`}
            </p>
          )}
        </div>
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-white"
          style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Badge QR" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[8px]" style={{ color: 'var(--muted)' }}>No QR</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-14" style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className={mono ? 'break-all font-mono' : 'break-words'}>{value}</dd>
    </div>
  );
}
