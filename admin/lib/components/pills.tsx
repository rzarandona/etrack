import type {
  CashAdvanceStatus,
  EventStatus,
  ScanType,
  ViolationSeverity,
} from '@/lib/types';

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

const ADVANCE_STATUS_CLASS: Record<CashAdvanceStatus, string> = {
  pending: 'pill status-pending',
  applied: 'pill status-active',
  deferred: 'pill status-processing',
  cancelled: 'pill status-inactive',
};

const ADVANCE_STATUS_LABEL: Record<CashAdvanceStatus, string> = {
  pending: 'Pending',
  applied: 'Applied',
  deferred: 'Deferred',
  cancelled: 'Cancelled',
};

export function CashAdvanceStatusPill({ status }: { status: CashAdvanceStatus }) {
  return (
    <span className={ADVANCE_STATUS_CLASS[status]}>● {ADVANCE_STATUS_LABEL[status]}</span>
  );
}

const SEVERITY_CLASS: Record<ViolationSeverity, string> = {
  minor: 'pill status-processing',
  major: 'pill status-pending',
  critical: 'pill status-inactive',
};

const SEVERITY_LABEL: Record<ViolationSeverity, string> = {
  minor: 'Minor',
  major: 'Major',
  critical: 'Critical',
};

export function ViolationSeverityPill({ severity }: { severity: ViolationSeverity }) {
  return (
    <span className={SEVERITY_CLASS[severity]}>● {SEVERITY_LABEL[severity]}</span>
  );
}

export function ResolutionPill({ resolved }: { resolved: boolean }) {
  return (
    <span className={resolved ? 'pill status-active' : 'pill status-pending'}>
      ● {resolved ? 'Resolved' : 'Open'}
    </span>
  );
}
