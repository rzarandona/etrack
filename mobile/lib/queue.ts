import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import type { PendingScan } from './types';

const KEY = 'etrack.pending_scans.v1';
const PHOTO_BUCKET = 'scan-photos';

async function readAll(): Promise<PendingScan[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingScan[];
  } catch {
    return [];
  }
}

async function writeAll(items: PendingScan[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(scan: PendingScan): Promise<void> {
  const all = await readAll();
  if (all.some((s) => s.client_scan_id === scan.client_scan_id)) return;
  all.push(scan);
  await writeAll(all);
}

export async function listPending(): Promise<PendingScan[]> {
  return readAll();
}

export async function pendingCount(): Promise<number> {
  return (await readAll()).length;
}

/**
 * Permanently drop a single pending scan from the queue. Time/attendance data
 * for this scan will NOT be uploaded — caller has confirmed the loss.
 * Also deletes the captured photo file, if any.
 */
export async function discardPending(clientScanId: string): Promise<void> {
  const all = await readAll();
  const target = all.find((s) => s.client_scan_id === clientScanId);
  if (target?.local_photo_uri) {
    await FileSystem.deleteAsync(target.local_photo_uri, { idempotent: true }).catch(() => {});
  }
  await writeAll(all.filter((s) => s.client_scan_id !== clientScanId));
}

/**
 * Permanently drop every queued scan. Same loss caveat as discardPending —
 * caller must confirm.
 */
export async function discardAllPending(): Promise<number> {
  const all = await readAll();
  for (const s of all) {
    if (s.local_photo_uri) {
      await FileSystem.deleteAsync(s.local_photo_uri, { idempotent: true }).catch(() => {});
    }
  }
  await writeAll([]);
  return all.length;
}

function isDuplicateStorageError(err: unknown): boolean {
  const e = err as { statusCode?: string; error?: string; message?: string };
  return (
    e?.statusCode === '409' ||
    e?.error === 'Duplicate' ||
    /already exists|duplicate/i.test(e?.message ?? '')
  );
}

/**
 * Upload a local photo to scan-photos at {supervisorId}/{clientScanId}.jpg.
 * Returns the storage path on success. Treats duplicate-key as success
 * (idempotent on retry: the same client_scan_id gives the same path).
 *
 * On React Native, `fetch(file://).blob()` produces a Blob that supabase-js
 * cannot actually read — uploads silently fail. Read the file as base64 via
 * expo-file-system and upload the decoded bytes as a Uint8Array instead.
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function uploadPhoto(
  localUri: string,
  supervisorId: string,
  clientScanId: string
): Promise<string> {
  const path = `${supervisorId}/${clientScanId}.jpg`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });

  if (error && !isDuplicateStorageError(error)) {
    throw error;
  }
  return path;
}

/**
 * Try to flush every queued scan to Supabase. For scans with a local photo,
 * upload the photo first (idempotent on retry), then insert the scan row,
 * then delete the local file. Server enforces idempotency on the scan via
 * client_scan_id (unique), so partial-success retries converge.
 */
export async function flush(supervisorId: string): Promise<number> {
  const all = await readAll();
  if (all.length === 0) return 0;

  const remaining: PendingScan[] = [];
  let synced = 0;

  for (const s of all) {
    try {
      let photoPath: string | null = null;

      if (s.local_photo_uri) {
        photoPath = await uploadPhoto(s.local_photo_uri, supervisorId, s.client_scan_id);
      }

      const { error } = await supabase.from('scans').insert({
        employee_id: s.employee_id,
        supervisor_id: supervisorId,
        event_id: s.event_id,
        phase_id: s.phase_id,
        scan_type: s.scan_type,
        device_timestamp: s.device_timestamp,
        latitude: s.latitude,
        longitude: s.longitude,
        accuracy_m: s.accuracy_m,
        is_mock_location: s.is_mock_location,
        self_clocked: s.self_clocked,
        client_scan_id: s.client_scan_id,
        verification_photo_url: photoPath, // stores storage path; admin generates signed URL on read
      });

      // 23505 = unique_violation: server already has this client_scan_id, treat as success.
      if (error && (error as { code?: string }).code !== '23505') {
        throw error;
      }

      // success — clean up the local photo file if we had one
      if (s.local_photo_uri) {
        await FileSystem.deleteAsync(s.local_photo_uri, { idempotent: true });
      }
      synced++;
    } catch (e) {
      remaining.push({
        ...s,
        attempts: s.attempts + 1,
        last_error: (e as Error).message ?? String(e),
      });
    }
  }

  await writeAll(remaining);
  return synced;
}
