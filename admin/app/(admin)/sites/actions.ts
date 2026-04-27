'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createSite(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const name = String(formData.get('name') ?? '').trim();
  const lat = String(formData.get('latitude') ?? '').trim();
  const lng = String(formData.get('longitude') ?? '').trim();
  const radius = String(formData.get('geofence_radius_m') ?? '').trim();

  if (!name) return { ok: false, error: 'Site name is required.' };

  const { error } = await supabase.from('sites').insert({
    name,
    latitude: lat.length > 0 ? Number(lat) : null,
    longitude: lng.length > 0 ? Number(lng) : null,
    geofence_radius_m: radius.length > 0 ? Number(radius) : null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sites');
  return { ok: true };
}

export async function setSiteActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('sites').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sites');
  return { ok: true };
}
