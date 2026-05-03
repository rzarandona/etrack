import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { getDirectoryStatus, refreshDirectory, type DirectoryStatus } from '@/lib/directory';
import { getMyEmployee } from '@/lib/employee';
import { flush, pendingCount } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import type { Employee, EventStatus } from '@/lib/types';

function relativeTime(date: Date | null): string {
  if (!date) return 'never';
  const ms = Date.now() - date.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function Home() {
  const { profile, signOut } = useAuth();

  if (!profile) return null;

  if (profile.role === 'pending') {
    return <PendingHome onSignOut={signOut} fullName={profile.full_name} />;
  }

  if (profile.role === 'employee') {
    return <EmployeeHome profileId={profile.id} fullName={profile.full_name} onSignOut={signOut} />;
  }

  // admin or supervisor
  return <SupervisorHome />;
}

// ============================================================
// Pending — awaiting admin approval
// ============================================================
function PendingHome({ fullName, onSignOut }: { fullName: string; onSignOut: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.bigTitle}>Awaiting approval</Text>
      <Text style={styles.muted}>
        Hi {fullName}, your account is pending admin approval. You&apos;ll get full access once your
        admin promotes you to an employee or supervisor role.
      </Text>
      <Pressable style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// Employee — see assigned events, tap to clock in/out per phase
// ============================================================
type EventRow = {
  id: string;
  title: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
  event_phases: { id: string; name: string; ord: number }[] | null;
};

function EmployeeHome({
  profileId,
  fullName,
  onSignOut,
}: {
  profileId: string;
  fullName: string;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const me = await getMyEmployee(profileId);
    setEmployee(me);

    // RLS already restricts events to those the user is assigned to.
    // Show events from yesterday onwards so completed events stay visible briefly.
    const since = new Date();
    since.setDate(since.getDate() - 1);
    since.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('events')
      .select('id, title, venue, starts_at, ends_at, status, event_phases(id, name, ord)')
      .gte('starts_at', since.toISOString())
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true });
    setEvents((data as unknown as EventRow[]) ?? []);
    setLoading(false);
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hi, {fullName}</Text>
          {employee && <Text style={styles.role}>{employee.employee_code}</Text>}
        </View>
        <Pressable onPress={onSignOut}>
          <Text style={styles.logout}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.linksRow}>
        <Pressable style={styles.linkCard} onPress={() => router.push('/(app)/advances' as never)}>
          <Text style={styles.linkText}>Cash advances ›</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => router.push('/(app)/violations' as never)}>
          <Text style={styles.linkText}>Violations ›</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>My events</Text>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>No events assigned to you yet.</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.eventCard}
              onPress={() => router.push(`/(app)/event/${item.id}` as never)}>
              <View style={styles.eventTopRow}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <EventStatusBadge status={item.status} />
              </View>
              <Text style={styles.eventMeta}>
                {new Date(item.starts_at).toLocaleString()}
                {item.ends_at && ` → ${new Date(item.ends_at).toLocaleString()}`}
              </Text>
              {item.venue && <Text style={styles.eventMeta}>📍 {item.venue}</Text>}
              {item.event_phases && item.event_phases.length > 0 && (
                <Text style={styles.eventPhasesPreview}>
                  {item.event_phases.length} phase{item.event_phases.length === 1 ? '' : 's'}: {' '}
                  {item.event_phases
                    .sort((a, b) => a.ord - b.ord)
                    .map((p) => p.name)
                    .join(' · ')}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function EventStatusBadge({ status }: { status: EventStatus }) {
  const palette: Record<EventStatus, { bg: string; fg: string; label: string }> = {
    planned: { bg: '#fef3c7', fg: '#a16207', label: 'PLANNED' },
    in_progress: { bg: '#dcfce7', fg: '#166534', label: 'LIVE' },
    completed: { bg: '#e2e8f0', fg: '#475569', label: 'DONE' },
    cancelled: { bg: '#fee2e2', fg: '#991b1b', label: 'CANCELLED' },
  };
  const p = palette[status];
  return (
    <Text style={{ backgroundColor: p.bg, color: p.fg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 10, fontWeight: '700' }}>
      {p.label}
    </Text>
  );
}

// ============================================================
// Supervisor / Admin — existing scan flow
// ============================================================
type RecentScan = {
  id: string;
  scan_type: 'in' | 'out';
  server_timestamp: string;
  employee: { full_name: string; employee_code: string } | null;
};

function SupervisorHome() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [directory, setDirectory] = useState<DirectoryStatus>({
    refreshedAt: null,
    employeeCount: 0,
  });

  const refresh = useCallback(async () => {
    setPending(await pendingCount());
    setDirectory(await getDirectoryStatus());

    if (profile) {
      refreshDirectory(profile.role, profile.id).then(async (ok) => {
        if (ok) setDirectory(await getDirectoryStatus());
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('server_timestamp', startOfDay.toISOString());
    setTodayCount(count ?? 0);

    const { data } = await supabase
      .from('scans')
      .select('id, scan_type, server_timestamp, employee:employees(full_name, employee_code)')
      .order('server_timestamp', { ascending: false })
      .limit(10);
    setRecent((data as unknown as RecentScan[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onSync = async () => {
    if (!profile) return;
    setSyncing(true);
    try {
      const synced = await flush(profile.id);
      await refresh();
      Alert.alert('Sync complete', `${synced} scan(s) uploaded.`);
    } catch (e) {
      Alert.alert('Sync failed', (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hi, {profile?.full_name ?? 'Supervisor'}</Text>
          <Text style={styles.role}>{profile?.role ?? ''}</Text>
        </View>
        <Pressable onPress={signOut}>
          <Text style={styles.logout}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{todayCount}</Text>
          <Text style={styles.statLabel}>Scans today</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.stat,
            pending > 0 && styles.statWarn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.push('/(app)/pending')}>
          <Text style={[styles.statValue, pending > 0 && styles.statValueWarn]}>{pending}</Text>
          <Text style={styles.statLabel}>Pending sync ›</Text>
        </Pressable>
      </View>

      <Text style={styles.dirStatus}>
        Offline directory: {directory.employeeCount} employee
        {directory.employeeCount === 1 ? '' : 's'} · refreshed {relativeTime(directory.refreshedAt)}
      </Text>

      <Pressable style={styles.scanButton} onPress={() => router.push('/(app)/scan')}>
        <Text style={styles.scanButtonText}>Scan badge</Text>
      </Pressable>

      {pending > 0 && (
        <Pressable style={styles.syncButton} onPress={onSync} disabled={syncing}>
          <Text style={styles.syncButtonText}>{syncing ? 'Syncing…' : `Sync ${pending} pending`}</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Recent scans</Text>
      <FlatList
        data={recent}
        keyExtractor={(s) => s.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={<Text style={styles.empty}>No scans yet today.</Text>}
        renderItem={({ item }) => (
          <View style={styles.scanRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanName}>{item.employee?.full_name ?? '(unknown)'}</Text>
              <Text style={styles.scanMeta}>
                {item.employee?.employee_code} ·{' '}
                {new Date(item.server_timestamp).toLocaleTimeString()}
              </Text>
            </View>
            <Text style={[styles.badge, item.scan_type === 'in' ? styles.badgeIn : styles.badgeOut]}>
              {item.scan_type.toUpperCase()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  bigTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  muted: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  signOutBtn: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, marginTop: 12 },
  signOutText: { color: '#475569', fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { fontSize: 18, fontWeight: '600' },
  role: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  logout: { color: '#dc2626', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 16, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center' },
  statWarn: { backgroundColor: '#fef3c7' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statValueWarn: { color: '#b45309' },
  statLabel: { color: '#64748b', fontSize: 12 },
  dirStatus: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: -4 },
  scanButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 22,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  syncButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 8 },
  sep: { height: 1, backgroundColor: '#e2e8f0' },
  scanRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  scanName: { fontSize: 15, fontWeight: '500' },
  scanMeta: { color: '#64748b', fontSize: 12 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeIn: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeOut: { backgroundColor: '#fee2e2', color: '#991b1b' },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 20 },
  eventCard: {
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  eventMeta: { fontSize: 12, color: '#64748b' },
  eventPhasesPreview: { fontSize: 12, color: '#475569', marginTop: 4 },
  linksRow: { flexDirection: 'row', gap: 10 },
  linkCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center',
  },
  linkText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
});
