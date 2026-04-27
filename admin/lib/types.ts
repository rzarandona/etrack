export type Role = 'admin' | 'supervisor' | 'employee' | 'pending';
export type ScanType = 'in' | 'out';
export type EventStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type AssignmentRole = 'supervisor' | 'employee';
export type CashAdvanceStatus = 'pending' | 'applied' | 'deferred' | 'cancelled';
export type ViolationSeverity = 'minor' | 'major' | 'critical';

/**
 * The canonical user record. `id` is an internal UUID (auto-generated for new
 * rows); `auth_user_id` is the FK to `auth.users` for loginable users (NULL
 * for seed/test data). Employees additionally have a row in `employees`
 * linked via `employees.user_profile_id` → `user_profiles.id`.
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
  home_address: string | null;
  home_latitude: string | null;
  home_longitude: string | null;
  contact_no: string | null;
  birthdate: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  qr_badge_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Rate = {
  id: string;
  label: string;
  hourly_rate: string;
  active: boolean;
  created_at: string;
};

export type BadgeStatus = 'active' | 'deleted';

export type Badge = {
  id: string;
  employee_id: string;
  storage_path: string;
  status: BadgeStatus;
  created_at: string;
  updated_at: string;
};

export type EventRecord = {
  id: string;
  title: string;
  contact_person: string | null;
  contact_phone: string | null;
  venue: string | null;
  venue_latitude: string | null;
  venue_longitude: string | null;
  starts_at: string;
  ends_at: string | null;
  contract_price: string | null;
  labor_budget_pct_min: string;
  labor_budget_pct_max: string;
  workforce_needed: string | null;
  status: EventStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventPhase = {
  id: string;
  event_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  ord: number;
  pay_rate: string | null;
  notes: string | null;
  created_at: string;
};

export type EventAssignment = {
  id: string;
  event_id: string;
  user_id: string;
  role: AssignmentRole;
  pay_rate_override: string | null;
  created_at: string;
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

export type CashAdvance = {
  id: string;
  user_id: string;
  amount: string;
  advance_date: string;
  notes: string | null;
  status: CashAdvanceStatus;
  applied_event_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type MessageThread = {
  id: string;
  subject: string | null;
  created_by: string;
  created_at: string;
};

export type MessageParticipant = {
  thread_id: string;
  user_id: string;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type MessageRead = {
  message_id: string;
  user_id: string;
  read_at: string;
};

export type MessageAttachment = {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string | null;
  file_name: string | null;
  size_bytes: number | null;
  created_at: string;
};

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
