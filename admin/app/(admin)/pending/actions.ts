'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { generateAndStoreBadge } from '@/lib/badge';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const CODE_PREFIX = 'EMP-';
const CODE_PAD = 4;

async function nextEmployeeCode(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('employees')
    .select('employee_code')
    .like('employee_code', `${CODE_PREFIX}%`);
  if (error) throw error;
  const re = new RegExp(`^${CODE_PREFIX}(\\d+)$`);
  const max = (data ?? []).reduce<number>((acc, row) => {
    const m = re.exec(row.employee_code as string);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `${CODE_PREFIX}${String(max + 1).padStart(CODE_PAD, '0')}`;
}

function done(): ActionResult {
  revalidatePath('/pending');
  revalidatePath('/employees');
  return { ok: true };
}

/**
 * Approve a pending user as an employee. Two paths:
 *   - linkToEmployeeId: attach the existing employees row (no new HR record).
 *   - else: create a fresh employees row using the profile's full_name +
 *     hourly_rate; auto-generates an employee_code and a badge QR.
 */
export async function approveAsEmployee(
  profileId: string,
  opts: { linkToEmployeeId?: string; hourlyRate?: number }
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const { data: profile, error: profErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, role')
    .eq('id', profileId)
    .single();
  if (profErr || !profile) return { ok: false, error: profErr?.message ?? 'Profile not found.' };
  if (profile.role !== 'pending') return { ok: false, error: 'User is not pending.' };

  if (opts.linkToEmployeeId) {
    // Make sure the target employee row isn't already linked to a different
    // profile — that would silently break their session.
    const { data: target, error: tErr } = await supabase
      .from('employees')
      .select('id, user_profile_id')
      .eq('id', opts.linkToEmployeeId)
      .single();
    if (tErr || !target) return { ok: false, error: 'Employee record not found.' };
    if (target.user_profile_id && target.user_profile_id !== profileId) {
      return { ok: false, error: 'Employee record is already linked to another user.' };
    }

    const { error: linkErr } = await supabase
      .from('employees')
      .update({ user_profile_id: profileId, updated_at: new Date().toISOString() })
      .eq('id', opts.linkToEmployeeId);
    if (linkErr) return { ok: false, error: linkErr.message };
  } else {
    // Create a new employees row. hourly_rate optional; admin can fill the
    // rest (address, contact, photo, etc.) later via the employees page.
    for (let attempt = 0; attempt < 2; attempt++) {
      const employee_code = await nextEmployeeCode(supabase);
      const { data: emp, error } = await supabase
        .from('employees')
        .insert({
          employee_code,
          full_name: profile.full_name,
          hourly_rate: opts.hourlyRate ?? null,
          user_profile_id: profileId,
        })
        .select('id')
        .single();
      if (error) {
        if ((error as { code?: string }).code !== '23505') {
          return { ok: false, error: error.message };
        }
        continue;
      }
      try {
        const qr_badge_url = await generateAndStoreBadge(supabase, emp!.id as string);
        await supabase.from('employees').update({ qr_badge_url }).eq('id', emp!.id);
      } catch (e) {
        console.error('Badge generation failed:', e);
      }
      break;
    }
  }

  const { error: roleErr } = await supabase
    .from('user_profiles')
    .update({ role: 'employee' })
    .eq('id', profileId);
  if (roleErr) return { ok: false, error: roleErr.message };

  return done();
}

export async function approveAsSupervisor(profileId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: 'supervisor' })
    .eq('id', profileId)
    .eq('role', 'pending');
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function approveAsAdmin(profileId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: 'admin' })
    .eq('id', profileId)
    .eq('role', 'pending');
  if (error) return { ok: false, error: error.message };
  return done();
}

/**
 * Reject keeps the row but flips active=false so the user can't sign in
 * again. We don't delete because the row is FK'd to potential audit
 * artifacts (event assignments, scans) — even though pending users haven't
 * created any yet, the soft-delete mirrors the deactivate-don't-delete
 * pattern used elsewhere in the app.
 */
export async function rejectPending(profileId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('user_profiles')
    .update({ active: false })
    .eq('id', profileId)
    .eq('role', 'pending');
  if (error) return { ok: false, error: error.message };
  return done();
}
