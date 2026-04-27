'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { generateAndStoreBadge } from '@/lib/badge';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const CODE_PREFIX = 'EMP-';
const CODE_PAD = 4;
const PHOTO_BUCKET = 'employee-photos';

async function nextEmployeeCode(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('employees')
    .select('employee_code')
    .like('employee_code', `${CODE_PREFIX}%`);
  if (error) throw error;

  const re = new RegExp(`^${CODE_PREFIX}(\\d+)$`);
  const max = (data ?? []).reduce<number>((acc, row) => {
    const m = re.exec(row.employee_code as string);
    if (!m) return acc;
    return Math.max(acc, parseInt(m[1], 10));
  }, 0);

  return `${CODE_PREFIX}${String(max + 1).padStart(CODE_PAD, '0')}`;
}

function getExt(p: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(p);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

/**
 * Photos are uploaded by the client to `staging/{...}.{ext}` first because the
 * employee id doesn't exist yet at create time. After insert we move the file
 * to `{employeeId}/photo.{ext}`. On update with a new photo, same flow.
 */
async function moveStagingPhoto(
  supabase: SupabaseClient,
  stagingPath: string,
  employeeId: string
): Promise<string> {
  const ext = getExt(stagingPath);
  const dest = `${employeeId}/photo.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).move(stagingPath, dest);
  if (error) throw error;
  return dest;
}

function parseFields(formData: FormData) {
  const full_name = String(formData.get('full_name') ?? '').trim().toUpperCase();
  const home_address = String(formData.get('home_address') ?? '').trim();
  const home_lat = String(formData.get('home_latitude') ?? '').trim();
  const home_lng = String(formData.get('home_longitude') ?? '').trim();
  const contact_no = String(formData.get('contact_no') ?? '').trim();
  const birthdate = String(formData.get('birthdate') ?? '').trim();
  const ec_name = String(formData.get('emergency_contact_name') ?? '').trim();
  const ec_num = String(formData.get('emergency_contact_number') ?? '').trim();
  const rate_raw = String(formData.get('hourly_rate') ?? '').trim();
  const photo_staging_path = String(formData.get('photo_staging_path') ?? '').trim();

  return {
    full_name,
    home_address,
    home_latitude: home_lat ? Number(home_lat) : null,
    home_longitude: home_lng ? Number(home_lng) : null,
    contact_no,
    birthdate: birthdate || null,
    emergency_contact_name: ec_name || null,
    emergency_contact_number: ec_num || null,
    hourly_rate: rate_raw ? Number(rate_raw) : null,
    photo_staging_path: photo_staging_path || null,
  };
}

function validateRequired(f: ReturnType<typeof parseFields>): string | null {
  if (!f.full_name) return 'Full name is required.';
  if (!f.home_address) return 'Home address is required.';
  if (!f.contact_no) return 'Contact number is required.';
  if (!f.birthdate) return 'Birthdate is required.';
  return null;
}

export async function createEmployee(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parseFields(formData);
  const v = validateRequired(fields);
  if (v) return { ok: false, error: v };

  // Race-safe code generation: retry once on unique-violation collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const employee_code = await nextEmployeeCode(supabase);

    const { data: inserted, error } = await supabase
      .from('employees')
      .insert({
        employee_code,
        full_name: fields.full_name,
        hourly_rate: fields.hourly_rate,
        home_address: fields.home_address,
        home_latitude: fields.home_latitude,
        home_longitude: fields.home_longitude,
        contact_no: fields.contact_no,
        birthdate: fields.birthdate,
        emergency_contact_name: fields.emergency_contact_name,
        emergency_contact_number: fields.emergency_contact_number,
      })
      .select('id')
      .single();

    if (error) {
      if ((error as { code?: string }).code !== '23505') {
        return { ok: false, error: error.message };
      }
      continue;
    }

    const employeeId = inserted!.id as string;

    let photo_url: string | null = null;
    if (fields.photo_staging_path) {
      try {
        photo_url = await moveStagingPhoto(supabase, fields.photo_staging_path, employeeId);
      } catch (e) {
        // The employee row is saved — log and continue without a photo.
        console.error('Photo move failed:', e);
      }
    }

    let qr_badge_url: string | null = null;
    try {
      qr_badge_url = await generateAndStoreBadge(supabase, employeeId);
    } catch (e) {
      console.error('Badge generation failed:', e);
    }

    if (photo_url || qr_badge_url) {
      await supabase
        .from('employees')
        .update({ photo_url, qr_badge_url })
        .eq('id', employeeId);
    }

    revalidatePath('/employees');
    return { ok: true, id: employeeId };
  }

  return { ok: false, error: 'Could not generate a unique employee code. Try again.' };
}

export async function updateEmployee(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const fields = parseFields(formData);
  const v = validateRequired(fields);
  if (v) return { ok: false, error: v };

  let photo_url: string | undefined;
  if (fields.photo_staging_path) {
    try {
      photo_url = await moveStagingPhoto(supabase, fields.photo_staging_path, id);
    } catch (e) {
      return { ok: false, error: `Photo upload failed: ${(e as Error).message}` };
    }
  }

  const { error } = await supabase
    .from('employees')
    .update({
      full_name: fields.full_name,
      hourly_rate: fields.hourly_rate,
      home_address: fields.home_address,
      home_latitude: fields.home_latitude,
      home_longitude: fields.home_longitude,
      contact_no: fields.contact_no,
      birthdate: fields.birthdate,
      emergency_contact_name: fields.emergency_contact_name,
      emergency_contact_number: fields.emergency_contact_number,
      ...(photo_url ? { photo_url } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  // Ensure a badge exists. (QR encodes the employee uuid which never changes,
  // so we only generate one if missing.)
  const { data: emp } = await supabase
    .from('employees')
    .select('qr_badge_url')
    .eq('id', id)
    .single();
  if (!emp?.qr_badge_url) {
    try {
      const qr_badge_url = await generateAndStoreBadge(supabase, id);
      await supabase.from('employees').update({ qr_badge_url }).eq('id', id);
    } catch (e) {
      console.error('Badge regeneration failed:', e);
    }
  }

  revalidatePath('/employees');
  revalidatePath(`/employees/${id}`);
  return { ok: true, id };
}

export async function setEmployeeActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('employees')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/employees');
  return { ok: true };
}
