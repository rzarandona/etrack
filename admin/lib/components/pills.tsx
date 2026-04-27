import type { ScanType } from '@/lib/types';

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={active ? 'pill status-active' : 'pill status-inactive'}>
      ● {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function ScanTypePill({ type }: { type: ScanType }) {
  return (
    <span className={type === 'in' ? 'pill status-active' : 'pill status-pending'}>
      ● {type.toUpperCase()}
    </span>
  );
}

export function MockFlagPill() {
  return <span className="pill status-processing">● MOCK</span>;
}
