import { formatMoney } from '@/lib/format';

type Props = {
  contractPrice: number | null;
  laborMin: number;
  laborMax: number;
  employeeCount: number;
  phaseCount: number;
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function SuggestedPayRate({
  contractPrice,
  laborMin,
  laborMax,
  employeeCount,
  phaseCount,
}: Props) {
  const missing: string[] = [];
  if (!contractPrice || contractPrice <= 0) missing.push('contract price');
  if (employeeCount === 0) missing.push('at least one assigned employee');
  if (phaseCount === 0) missing.push('at least one phase');

  if (missing.length > 0) {
    return (
      <div className="card p-5">
        <h2 className="text-base font-bold mb-1">Suggested pay rate</h2>
        <p className="text-sm text-muted">
          Add {missing.join(' and ')} to compute a suggested rate.
        </p>
      </div>
    );
  }

  const price = contractPrice as number;
  const minTotal = price * laborMin;
  const maxTotal = price * laborMax;
  const minPer = minTotal / employeeCount / phaseCount;
  const maxPer = maxTotal / employeeCount / phaseCount;

  return (
    <div className="card p-5">
      <h2 className="text-base font-bold mb-3">Suggested pay rate</h2>

      <div className="rounded-xl bg-soft px-4 py-3 mb-3">
        <div className="text-xs uppercase tracking-wide text-muted">Per employee, per phase</div>
        <div className="text-3xl font-extrabold mt-1">
          {formatMoney(minPer)} <span className="text-muted text-base font-bold">–</span> {formatMoney(maxPer)}
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Stat label="Contract" value={formatMoney(price)} />
        <Stat label="Labor budget" value={`${pct(laborMin)} – ${pct(laborMax)}`} />
        <Stat label="Employees" value={String(employeeCount)} />
        <Stat label="Phases" value={String(phaseCount)} />
      </dl>

      <p className="mt-3 text-xs text-muted">
        Total labor pool: <strong>{formatMoney(minTotal)}</strong> – <strong>{formatMoney(maxTotal)}</strong>.
        If the per-employee rate looks low, add more crew or renegotiate the contract; if it looks high,
        you have headroom for margin.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-muted text-[10px]">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
