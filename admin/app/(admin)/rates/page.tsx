import { getSupabaseServer } from '@/lib/supabase/server';
import type { Rate } from '@/lib/types';
import { NewRateForm } from './new-rate-form';
import { RateRow } from './rate-row';

export default async function RatesPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('rates')
    .select('*')
    .order('active', { ascending: false })
    .order('hourly_rate', { ascending: false });
  const rates = (data as Rate[]) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Rates</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Preset hourly rates available in the employee form. Editing a rate doesn&apos;t
            change employees already saved with that rate — the value is copied at save time.
          </p>
        </div>
        <NewRateForm />
      </div>

      <div className="card p-5">
        {rates.length === 0 ? (
          <p className="py-10 text-center" style={{ color: 'var(--muted)' }}>
            No rates yet — add one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto scroll-hide">
            <table className="w-full text-sm">
              <colgroup>
                <col />
                <col style={{ width: '160px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '220px' }} />
              </colgroup>
              <thead>
                <tr className="text-left" style={{ color: 'var(--muted)' }}>
                  <th className="font-medium pb-3">Label</th>
                  <th className="font-medium pb-3 text-right pr-6">Hourly rate</th>
                  <th className="font-medium pb-3 pl-2">Status</th>
                  <th className="font-medium pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <RateRow key={r.id} rate={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
