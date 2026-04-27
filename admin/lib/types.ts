export type Role = 'supervisor' | 'admin';
export type ScanType = 'in' | 'out';

export type Employee = {
  id: string;
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

export type Site = {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  geofence_radius_m: number | null;
  active: boolean;
  created_at: string;
};

export type SupervisorProfile = {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
};

export type Scan = {
  id: string;
  employee_id: string;
  supervisor_id: string;
  site_id: string | null;
  scan_type: ScanType;
  server_timestamp: string;
  device_timestamp: string;
  latitude: string;
  longitude: string;
  accuracy_m: string | null;
  is_mock_location: boolean;
  client_scan_id: string;
  verification_photo_url: string | null;
  created_at: string;
};
