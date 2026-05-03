import { supabase } from './supabase';
import type { Employee } from './types';

/**
 * Look up the employees row for the currently signed-in user. Returns null
 * for users with no `employees` row (admins, unlinked supervisors, pending
 * users). RLS already restricts what's visible.
 */
export async function getMyEmployee(userProfileId: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .eq('active', true)
    .maybeSingle();
  if (error) return null;
  return (data as Employee) ?? null;
}
