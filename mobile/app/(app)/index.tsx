import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { getDirectoryStatus, refreshDirectory, type DirectoryStatus } from '@/lib/directory';
import { flush, pendingCount } from '@/lib/queue';
import { supabase } from '@/lib/supabase';

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

type RecentScan = {
  id: string;
  scan_type: 'in' | 'out';
  server_timestamp: string;
  employee: { full_name: string; employee_code: string } | null;
};

export default function Home() {
  const router = useRouter();
  const { profile, signOut, session } = useAuth();
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

    // Best-effort refresh of the offline directory; silently no-ops when offline.
    refreshDirectory().then(async (ok) => {
      if (ok) setDirectory(await getDirectoryStatus());
    });

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
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onSync = async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const synced = await flush(session.user.id);
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
});
