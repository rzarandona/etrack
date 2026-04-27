'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

export type RateActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createRate(formData: FormData): Promise<RateActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const label = String(formData.get('label') ?? '').trim();
  const rateRaw = String(formData.get('hourly_rate') ?? '').trim();
  if (!label) return { ok: false, error: 'Label is required.' };
  const hourly_rate = Number(rateRaw);
  if (!Number.isFinite(hourly_rate) || hourly_rate < 0) {
    return { ok: false, error: 'Hourly rate must be a non-negative number.' };
  }

  const { data, error } = await supabase
    .from('rates')
    .insert({ label, hourly_rate })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/rates');
  revalidatePath('/employees');
  return { ok: true, id: data?.id };
}

export async function updateRate(id: string, formData: FormData): Promise<RateActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();

  const label = String(formData.get('label') ?? '').trim();
  const rateRaw = String(formData.get('hourly_rate') ?? '').trim();
  if (!label) return { ok: false, error: 'Label is required.' };
  const hourly_rate = Number(rateRaw);
  if (!Number.isFinite(hourly_rate) || hourly_rate < 0) {
    return { ok: false, error: 'Hourly rate must be a non-negative number.' };
  }

  const { error } = await supabase.from('rates').update({ label, hourly_rate }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rates');
  revalidatePath('/employees');
  return { ok: true };
}

export async function setRateActive(id: string, active: boolean): Promise<RateActionResult> {
  await requireAdmin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('rates').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rates');
  revalidatePath('/employees');
  return { ok: true };
}
