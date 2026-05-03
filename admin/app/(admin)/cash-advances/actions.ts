'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { CashAdvanceStatus } from '@/lib/types';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function num(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

type Parsed = {
  user_id: string | null;
  amount: number | null;
  advance_date: string | null;
  notes: string | null;
  status: CashAdvanceStatus;
  applied_event_id: string | null;
};

const VALID_STATUS: CashAdvanceStatus[] = ['pending', 'applied', 'deferred', 'cancelled'];

function parse(fd: FormData): Parsed {
  const rawStatus = String(fd.get('status') ?? 'pending');
  const status = (VALID_STATUS as string[]).includes(rawStatus)
    ? (rawStatus as CashAdvanceStatus)
    : 'pending';
  return {
    user_id: str(fd.get('user_id')),
    amount: num(fd.get('amount')),
    advance_date: str(fd.get('advance_date')),
    notes: str(fd.get('notes')),
    status,
    applied_event_id: str(fd.get('applied_event_id')),
  };
}

function validate(f: Parsed): string | null {
  if (!f.user_id) return 'Pick an employee.';
  if (f.amount == null || f.amount <= 0) return 'Amount must be greater than zero.';
  if (!f.advance_date) return 'Advance date is required.';
  if (f.status === 'applied' && !f.applied_event_id) {
    return 'Applied advances need a target event.';
  }
  return null;
}

export async function createAdvance(formData: FormData): Promise<ActionResult> {
  const { profile } = await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parse(formData);
  const v = validate(fields);
  if (v) return { ok: false, error: v };

  const { data, error } = await supabase
    .from('cash_advances')
    .insert({
      user_id: fields.user_id,
      amount: fields.amount,
      advance_date: fields.advance_date,
      notes: fields.notes,
      status: fields.status,
      applied_event_id: fields.status === 'applied' ? fields.applied_event_id : null,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/cash-advances');
  return { ok: true, id: data!.id as string };
}

export async function updateAdvance(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parse(formData);
  const v = validate(fields);
  if (v) return { ok: false, error: v };

  const { error } = await supabase
    .from('cash_advances')
    .update({
      user_id: fields.user_id,
      amount: fields.amount,
      advance_date: fields.advance_date,
      notes: fields.notes,
      status: fields.status,
      applied_event_id: fields.status === 'applied' ? fields.applied_event_id : null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/cash-advances');
  return { ok: true, id };
}

/**
 * Quick status flip from the row actions. `applied_event_id` only matters
 * when the new status is 'applied'; for other statuses it's nulled so the
 * advance isn't accidentally still attributed to an event after being
 * deferred or cancelled.
 */
export async function setAdvanceStatus(
  id: string,
  status: CashAdvanceStatus,
  appliedEventId?: string
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  if (status === 'applied' && !appliedEventId) {
    return { ok: false, error: 'Applied advances need a target event.' };
  }

  const { error } = await supabase
    .from('cash_advances')
    .update({
      status,
      applied_event_id: status === 'applied' ? appliedEventId! : null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/cash-advances');
  return { ok: true };
}

export async function deleteAdvance(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('cash_advances').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/cash-advances');
  return { ok: true };
}
