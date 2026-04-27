import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Batch-sign a list of storage paths and return a `path → signed URL` map.
 * No-ops on an empty list. Failed signings are silently skipped (the path
 * just won't appear in the map, callers should fall back to a placeholder).
 */
export async function signPaths(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
  ttlSeconds: number = 60 * 60
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, ttlSeconds);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}
