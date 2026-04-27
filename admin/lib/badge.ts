import QRCode from 'qrcode';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'employee-photos';

/**
 * Generate a QR PNG for an employee (QR encodes the employee uuid), upload
 * it to {employeeId}/badge.png in the employee-photos bucket, and upsert a
 * `badges` row with status='active' so the badges page reflects current
 * state. Returns the storage path. Uses upsert on storage so re-saving an
 * employee refreshes the file.
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
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: true });
  if (upErr) throw upErr;

  // Track in the badges table — upsert so a previously soft-deleted row
  // flips back to 'active'.
  const { error: rowErr } = await supabase
    .from('badges')
    .upsert(
      {
        employee_id: employeeId,
        storage_path: path,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id' }
    );
  if (rowErr) {
    // Log but don't fail the badge generation — the file exists in storage
    // and the employee row's qr_badge_url is still updated by the caller.
    console.error('Badges row upsert failed:', rowErr);
  }

  return path;
}

/**
 * Sign a path in the employee-photos bucket for in-browser display. If the
 * input is already an absolute URL (dev seed data using pravatar/qrserver
 * placeholders), pass it through unchanged.
 */
export async function signEmployeePhoto(
  supabase: SupabaseClient,
  path: string,
  ttlSeconds: number = 60 * 60
): Promise<string | null> {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}
