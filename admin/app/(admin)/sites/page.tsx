import { StatusPill } from '@/lib/components/pills';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Site } from '@/lib/types';
import { NewSiteForm } from './new-site-form';
import { ToggleActiveButton } from './site-actions';

export default async function SitesPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('sites')
    .select('*')
    .order('active', { ascending: false })
    .order('name');
  const sites = (data as Site[]) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Sites</h1>
          <p className="text-sm mt-1 text-muted">
            Sites with a radius enforce geofencing on the mobile app at scan time.
          </p>
        </div>
        <NewSiteForm />
      </div>

      <div className="card p-5">
        {sites.length === 0 ? (
          <p className="py-10 text-center text-muted">No sites yet.</p>
        ) : (
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-medium pb-3">Name</th>
                  <th className="font-medium pb-3">Coordinates</th>
                  <th className="font-medium pb-3 text-right">Radius</th>
                  <th className="font-medium pb-3">Status</th>
                  <th className="font-medium pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="table-row border-t border-line">
                    <td className="py-3 font-bold">{s.name}</td>
                    <td className="py-3 font-mono text-xs text-muted">
                      {s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '—'}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {s.geofence_radius_m ? `${s.geofence_radius_m} m` : <span className="text-muted">no fence</span>}
                    </td>
                    <td className="py-3">
                      <StatusPill active={s.active} />
                    </td>
                    <td className="py-3 text-right">
                      <ToggleActiveButton id={s.id} active={s.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
