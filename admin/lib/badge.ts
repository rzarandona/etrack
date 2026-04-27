import QRCode from 'qrcode';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'employee-photos';

/**
 * Generate a QR PNG for an employee (QR encodes the employee uuid) and upload
 * it to {employeeId}/badge.png in the employee-photos bucket. Returns the
 * storage path. Uses upsert so re-saving an employee refreshes the badge.
 */
export async function generateAndStoreBadge(
  supabase: SupabaseClient,
  employeeId: string
): Promise<string> {
  const png = await QRCode.toBuffer(employeeId, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
  });

  const path = `${employeeId}/badge.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  return path;
}

/** Sign a path in the employee-photos bucket for in-browser display. */
export async function signEmployeePhoto(
  supabase: SupabaseClient,
  path: string,
  ttlSeconds: number = 60 * 60
): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}
