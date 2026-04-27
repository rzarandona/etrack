import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Employee, Site } from './types';

const KEY_EMPLOYEES = 'etrack.directory.employees.v1';
const KEY_SITES = 'etrack.directory.sites.v1';
const KEY_REFRESHED_AT = 'etrack.directory.refreshed_at';

export type DirectoryStatus = {
  refreshedAt: Date | null;
  employeeCount: number;
  siteCount: number;
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Pull active employees + sites from Supabase and cache locally so the
 * supervisor can confirm a scan without a connection. Caller should only
 * invoke when online; failures here are silent (the cache stays as-is).
 */
export async function refreshDirectory(): Promise<boolean> {
  try {
    const [{ data: employees, error: e1 }, { data: sites, error: e2 }] = await Promise.all([
      supabase.from('employees').select('*').eq('active', true),
      supabase.from('sites').select('*').eq('active', true).order('name'),
    ]);
    if (e1 || e2) return false;
    await AsyncStorage.multiSet([
      [KEY_EMPLOYEES, JSON.stringify(employees ?? [])],
      [KEY_SITES, JSON.stringify(sites ?? [])],
      [KEY_REFRESHED_AT, new Date().toISOString()],
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function getCachedEmployee(id: string): Promise<Employee | null> {
  const list = (await readJson<Employee[]>(KEY_EMPLOYEES)) ?? [];
  return list.find((e) => e.id === id) ?? null;
}

export async function getCachedSites(): Promise<Site[]> {
  return (await readJson<Site[]>(KEY_SITES)) ?? [];
}

export async function getDirectoryStatus(): Promise<DirectoryStatus> {
  const [employees, sites, refreshed] = await Promise.all([
    readJson<Employee[]>(KEY_EMPLOYEES),
    readJson<Site[]>(KEY_SITES),
    AsyncStorage.getItem(KEY_REFRESHED_AT),
  ]);
  return {
    refreshedAt: refreshed ? new Date(refreshed) : null,
    employeeCount: employees?.length ?? 0,
    siteCount: sites?.length ?? 0,
  };
}
