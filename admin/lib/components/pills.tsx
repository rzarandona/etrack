import type { EventStatus, ScanType } from '@/lib/types';

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

const EVENT_STATUS_CLASS: Record<EventStatus, string> = {
  planned: 'pill status-processing',
  in_progress: 'pill status-pending',
  completed: 'pill status-active',
  cancelled: 'pill status-inactive',
};

const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function EventStatusPill({ status }: { status: EventStatus }) {
  return (
    <span className={EVENT_STATUS_CLASS[status]}>● {EVENT_STATUS_LABEL[status]}</span>
  );
}
