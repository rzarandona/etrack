export type Role = 'admin' | 'supervisor' | 'employee' | 'pending';
export type ScanType = 'in' | 'out';
export type EventStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type AssignmentRole = 'supervisor' | 'employee';
export type CashAdvanceStatus = 'pending' | 'applied' | 'deferred' | 'cancelled';
export type ViolationSeverity = 'minor' | 'major' | 'critical';

export type Violation = {
  id: string;
  event_id: string | null;
  phase_id: string | null;
  reported_by: string;
  employee_id: string;
  description: string;
  severity: ViolationSeverity;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

export type CashAdvance = {
  id: string;
  user_id: string;
  amount: string;
  advance_date: string;
  notes: string | null;
  status: CashAdvanceStatus;
  applied_event_id: string | null;
  created_at: string;
};

/**
 * The canonical user record. `id` is an internal UUID; `auth_user_id` is the
 * FK to `auth.users` for loginable users (NULL for seed/test data).
 */
export type UserProfile = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
};

export type Employee = {
  id: string;
  user_profile_id: string | null;
  employee_code: string;
  full_name: string;
  photo_url: string | null;
  hourly_rate: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type EventRecord = {
  id: string;
  title: string;
  venue: string | null;
  venue_latitude: string | null;
  venue_longitude: string | null;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
};

export type EventPhase = {
  id: string;
  event_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  ord: number;
  pay_rate: string | null;
};

export type Scan = {
  id: string;
  employee_id: string;
  supervisor_id: string;
  event_id: string | null;
  phase_id: string | null;
  scan_type: ScanType;
  server_timestamp: string;
  device_timestamp: string;
  latitude: string;
  longitude: string;
  accuracy_m: string | null;
  is_mock_location: boolean;
  self_clocked: boolean;
  client_scan_id: string;
  verification_photo_url: string | null;
  created_at: string;
};

export type PendingScan = {
  client_scan_id: string;
  employee_id: string;
  event_id: string | null;
  phase_id: string | null;
  scan_type: ScanType;
  device_timestamp: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  is_mock_location: boolean;
  self_clocked: boolean;
  /** Local file:// uri of the captured photo, if any. Uploaded then cleared on flush. */
  local_photo_uri: string | null;
  queued_at: string;
  attempts: number;
  last_error: string | null;
};
