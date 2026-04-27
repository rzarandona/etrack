import type { SupabaseClient } from '@supabase/supabase-js';

function isExternalUrl(p: string): boolean {
  return p.startsWith('http://') || p.startsWith('https://');
}

/**
 * Batch-sign a list of storage paths and return a `path → signed URL` map.
 * No-ops on an empty list. Failed signings are silently skipped (the path
 * just won't appear in the map, callers should fall back to a placeholder).
 *
 * Inputs that look like absolute URLs (`http(s)://…`) — used by dev seed
 * data with pravatar / qrserver placeholders — are passed through unchanged
 * so the admin UI shows an image without storage round-trips.
 */
export async function signPaths(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
  ttlSeconds: number = 60 * 60
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const out: Record<string, string> = {};
  const storagePaths: string[] = [];
  for (const p of paths) {
    if (isExternalUrl(p)) out[p] = p;
    else storagePaths.push(p);
  }

  if (storagePaths.length > 0) {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(storagePaths, ttlSeconds);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
    }
  }
  return out;
}
