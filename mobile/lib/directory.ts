import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Employee, Role } from './types';

const KEY_EMPLOYEES = 'etrack.directory.employees.v1';
const KEY_REFRESHED_AT = 'etrack.directory.refreshed_at';

export type DirectoryStatus = {
  refreshedAt: Date | null;
  employeeCount: number;
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeCache(employees: Employee[]): Promise<void> {
  await AsyncStorage.multiSet([
    [KEY_EMPLOYEES, JSON.stringify(employees)],
    [KEY_REFRESHED_AT, new Date().toISOString()],
  ]);
}

/**
 * Pull the offline employee directory.
 *
 *   * admin       → all active employees (full HR roster).
 *   * supervisor  → only employees assigned to events the supervisor is
 *                   also assigned to (data minimization — supervisor scans
 *                   shouldn't reveal employees they have no business with).
 *   * employee /  → no directory needed (they only self-clock-in their own
 *     pending      record); refresh is a no-op.
 *
 * Caller should only invoke when online; failures are silent (the cache
 * stays as-is). If RLS blocks any query, we get an empty list back, which
 * is the correct fallback (cache shrinks to what's authorized).
 */
export async function refreshDirectory(
  role: Role,
  userProfileId: string
): Promise<boolean> {
  if (role === 'employee' || role === 'pending') return false;

  try {
    if (role === 'admin') {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true);
      if (error) return false;
      await writeCache((data as Employee[]) ?? []);
      return true;
    }

    // Supervisor: events I'm assigned to
    const { data: myEvents, error: e1 } = await supabase
      .from('event_assignments')
      .select('event_id')
      .eq('user_id', userProfileId)
      .eq('role', 'supervisor');
    if (e1) return false;
    const eventIds = (myEvents ?? []).map((r) => r.event_id as string);
    if (eventIds.length === 0) {
      await writeCache([]);
      return true;
    }

    // Employees on those events
    const { data: empAssignments, error: e2 } = await supabase
      .from('event_assignments')
      .select('user_id')
      .in('event_id', eventIds)
      .eq('role', 'employee');
    if (e2) return false;
    const empUserIds = Array.from(
      new Set((empAssignments ?? []).map((r) => r.user_id as string))
    );
    if (empUserIds.length === 0) {
      await writeCache([]);
      return true;
    }

    const { data: emps, error: e3 } = await supabase
      .from('employees')
      .select('*')
      .in('user_profile_id', empUserIds)
      .eq('active', true);
    if (e3) return false;

    await writeCache((emps as Employee[]) ?? []);
    return true;
  } catch {
    return false;
  }
}

export async function getCachedEmployee(id: string): Promise<Employee | null> {
  const list = (await readJson<Employee[]>(KEY_EMPLOYEES)) ?? [];
  return list.find((e) => e.id === id) ?? null;
}

export async function getDirectoryStatus(): Promise<DirectoryStatus> {
  const [employees, refreshed] = await Promise.all([
    readJson<Employee[]>(KEY_EMPLOYEES),
    AsyncStorage.getItem(KEY_REFRESHED_AT),
  ]);
  return {
    refreshedAt: refreshed ? new Date(refreshed) : null,
    employeeCount: employees?.length ?? 0,
  };
}
