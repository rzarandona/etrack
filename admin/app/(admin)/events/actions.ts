'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { AssignmentRole, EventStatus } from '@/lib/types';

export type EventActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

function parseEvent(fd: FormData) {
  const title = String(fd.get('title') ?? '').trim();
  const starts_at = String(fd.get('starts_at') ?? '').trim();
  return {
    title,
    contact_person: str(fd.get('contact_person')),
    contact_phone: str(fd.get('contact_phone')),
    venue: str(fd.get('venue')),
    venue_latitude: num(fd.get('venue_latitude')),
    venue_longitude: num(fd.get('venue_longitude')),
    starts_at,
    ends_at: str(fd.get('ends_at')),
    contract_price: num(fd.get('contract_price')),
    workforce_needed: str(fd.get('workforce_needed')),
    status: (str(fd.get('status')) ?? 'planned') as EventStatus,
    notes: str(fd.get('notes')),
  };
}

function validateEvent(f: ReturnType<typeof parseEvent>): string | null {
  if (!f.title) return 'Event title is required.';
  if (!f.starts_at) return 'Start date/time is required.';
  return null;
}

export async function createEvent(formData: FormData): Promise<EventActionResult> {
  const { userId } = await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parseEvent(formData);
  const v = validateEvent(fields);
  if (v) return { ok: false, error: v };

  const { data, error } = await supabase
    .from('events')
    .insert({ ...fields, created_by: userId })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  // Seed three default phases (admin can edit/add/remove on the detail page).
  const eventId = data!.id as string;
  await supabase.from('event_phases').insert([
    { event_id: eventId, name: 'Ingress',      ord: 1 },
    { event_id: eventId, name: 'Event Proper', ord: 2 },
    { event_id: eventId, name: 'Egress',       ord: 3 },
  ]);

  revalidatePath('/events');
  return { ok: true, id: eventId };
}

export async function updateEvent(id: string, formData: FormData): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parseEvent(formData);
  const v = validateEvent(fields);
  if (v) return { ok: false, error: v };

  const { error } = await supabase
    .from('events')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/events');
  revalidatePath(`/events/${id}`);
  return { ok: true, id };
}

export async function setEventStatus(id: string, status: EventStatus): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/events');
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

/**
 * Hard delete: phases + assignments cascade via FK; scans tied to this event
 * also cascade. Caller must have confirmed in UI — this is destructive.
 */
export async function deleteEvent(id: string): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/events');
  return { ok: true };
}

// ============================================================
// Phases
// ============================================================

export async function addPhase(
  eventId: string,
  formData: FormData
): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Phase name is required.' };

  // Next ord: max + 1
  const { data: existing } = await supabase
    .from('event_phases')
    .select('ord')
    .eq('event_id', eventId)
    .order('ord', { ascending: false })
    .limit(1);
  const nextOrd = ((existing ?? [])[0]?.ord ?? 0) + 1;

  const { error } = await supabase.from('event_phases').insert({
    event_id: eventId,
    name,
    ord: nextOrd,
    starts_at: str(formData.get('starts_at')),
    ends_at: str(formData.get('ends_at')),
    pay_rate: num(formData.get('pay_rate')),
    notes: str(formData.get('notes')),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function updatePhase(
  phaseId: string,
  formData: FormData
): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Phase name is required.' };

  const { data: phase, error: lookupErr } = await supabase
    .from('event_phases')
    .select('event_id')
    .eq('id', phaseId)
    .single();
  if (lookupErr || !phase) return { ok: false, error: 'Phase not found.' };

  const { error } = await supabase
    .from('event_phases')
    .update({
      name,
      starts_at: str(formData.get('starts_at')),
      ends_at: str(formData.get('ends_at')),
      pay_rate: num(formData.get('pay_rate')),
      notes: str(formData.get('notes')),
    })
    .eq('id', phaseId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${phase.event_id}`);
  return { ok: true };
}

export async function removePhase(phaseId: string): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { data: phase } = await supabase
    .from('event_phases')
    .select('event_id')
    .eq('id', phaseId)
    .single();
  const { error } = await supabase.from('event_phases').delete().eq('id', phaseId);
  if (error) return { ok: false, error: error.message };
  if (phase?.event_id) revalidatePath(`/events/${phase.event_id}`);
  return { ok: true };
}

// ============================================================
// Assignments
// ============================================================

export async function assignUser(
  eventId: string,
  userId: string,
  role: AssignmentRole
): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('event_assignments')
    .insert({ event_id: eventId, user_id: userId, role });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function removeAssignment(assignmentId: string): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { data: a } = await supabase
    .from('event_assignments')
    .select('event_id')
    .eq('id', assignmentId)
    .single();
  const { error } = await supabase.from('event_assignments').delete().eq('id', assignmentId);
  if (error) return { ok: false, error: error.message };
  if (a?.event_id) revalidatePath(`/events/${a.event_id}`);
  return { ok: true };
}

export async function setAssignmentRate(
  assignmentId: string,
  payRate: number | null
): Promise<EventActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { data: a } = await supabase
    .from('event_assignments')
    .select('event_id')
    .eq('id', assignmentId)
    .single();
  const { error } = await supabase
    .from('event_assignments')
    .update({ pay_rate_override: payRate })
    .eq('id', assignmentId);
  if (error) return { ok: false, error: error.message };
  if (a?.event_id) revalidatePath(`/events/${a.event_id}`);
  return { ok: true };
}
