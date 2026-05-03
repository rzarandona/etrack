'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { ViolationSeverity } from '@/lib/types';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const VALID_SEVERITY: ViolationSeverity[] = ['minor', 'major', 'critical'];

function str(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

type Parsed = {
  employee_id: string | null;
  event_id: string | null;
  phase_id: string | null;
  severity: ViolationSeverity;
  description: string | null;
};

function parse(fd: FormData): Parsed {
  const rawSeverity = String(fd.get('severity') ?? 'minor');
  const severity = (VALID_SEVERITY as string[]).includes(rawSeverity)
    ? (rawSeverity as ViolationSeverity)
    : 'minor';
  return {
    employee_id: str(fd.get('employee_id')),
    event_id: str(fd.get('event_id')),
    phase_id: str(fd.get('phase_id')),
    severity,
    description: str(fd.get('description')),
  };
}

function validate(f: Parsed): string | null {
  if (!f.employee_id) return 'Pick an employee.';
  if (!f.description) return 'Description is required.';
  if (f.phase_id && !f.event_id) {
    return 'A phase requires an event.';
  }
  return null;
}

export async function createViolation(formData: FormData): Promise<ActionResult> {
  const { profile } = await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parse(formData);
  const v = validate(fields);
  if (v) return { ok: false, error: v };

  const { data, error } = await supabase
    .from('violations')
    .insert({
      employee_id: fields.employee_id,
      event_id: fields.event_id,
      phase_id: fields.phase_id,
      severity: fields.severity,
      description: fields.description,
      reported_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/violations');
  return { ok: true, id: data!.id as string };
}

export async function updateViolation(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parse(formData);
  const v = validate(fields);
  if (v) return { ok: false, error: v };

  const { error } = await supabase
    .from('violations')
    .update({
      employee_id: fields.employee_id,
      event_id: fields.event_id,
      phase_id: fields.phase_id,
      severity: fields.severity,
      description: fields.description,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/violations');
  return { ok: true, id };
}

export async function setResolved(id: string, resolved: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('violations')
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/violations');
  return { ok: true };
}

export async function deleteViolation(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('violations').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/violations');
  return { ok: true };
}
