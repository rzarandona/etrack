import { signPaths } from '@/lib/storage';
import { getSupabaseServer } from '@/lib/supabase/server';
import { BadgeExportForm } from './badge-export-form';

export default async function BadgesPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, active, qr_badge_url')
    .order('active', { ascending: false })
    .order('employee_code');
  const employees = data ?? [];

  const qrUrlByPath = await signPaths(
    supabase,
    'employee-photos',
    employees.map((e) => e.qr_badge_url).filter((p): p is string => Boolean(p))
  );

  const qrUrlByEmployeeId: Record<string, string | null> = {};
  for (const e of employees) {
    qrUrlByEmployeeId[e.id] = e.qr_badge_url ? qrUrlByPath[e.qr_badge_url] ?? null : null;
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Badges</h1>
        <p className="text-sm mt-1 text-muted">
          Pick employees and export a ZIP containing one QR PNG per badge plus a CSV of
          employee data — ready to hand to your PVC card printing vendor.
        </p>
      </div>
      <div className="card p-5">
        <BadgeExportForm employees={employees} qrUrlByEmployeeId={qrUrlByEmployeeId} />
      </div>
    </div>
  );
}
