import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Violation, ViolationSeverity } from '@/lib/types';

type Row = Violation & {
  event: { id: string; title: string } | null;
  phase: { id: string; name: string } | null;
  reporter: { id: string; full_name: string } | null;
};

const SEVERITY_PALETTE: Record<ViolationSeverity, { bg: string; fg: string; label: string }> = {
  minor: { bg: '#dbeafe', fg: '#1e40af', label: 'MINOR' },
  major: { bg: '#fef3c7', fg: '#a16207', label: 'MAJOR' },
  critical: { bg: '#fee2e2', fg: '#991b1b', label: 'CRITICAL' },
};

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Violations() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('violations')
      .select(
        'id, event_id, phase_id, reported_by, employee_id, description, severity, resolved, resolved_at, created_at,' +
          ' event:events(id, title),' +
          ' phase:event_phases(id, name),' +
          ' reporter:user_profiles!violations_reported_by_fkey(id, full_name)'
      )
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const counts = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      if (!r.resolved) acc.open += 1;
      return acc;
    },
    { total: 0, open: 0 }
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>My violations</Text>
      <Text style={styles.subtitle}>
        {counts.open} open · {counts.total} total
      </Text>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No violations on record. Keep it up.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const palette = SEVERITY_PALETTE[item.severity];
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={[styles.severity, { backgroundColor: palette.bg, color: palette.fg }]}>
                    {palette.label}
                  </Text>
                  <Text style={[styles.status, item.resolved ? styles.statusResolved : styles.statusOpen]}>
                    {item.resolved ? 'Resolved' : 'Open'}
                  </Text>
                </View>
                <Text style={styles.description}>{item.description}</Text>
                {item.event && (
                  <Text style={styles.meta}>
                    {item.event.title}
                    {item.phase ? ` · ${item.phase.name}` : ''}
                  </Text>
                )}
                <Text style={styles.meta}>
                  {item.reporter?.full_name ?? 'Unknown'} · {formatDate(item.created_at)}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  card: {
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  severity: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  status: { fontSize: 11, fontWeight: '600' },
  statusOpen: { color: '#a16207' },
  statusResolved: { color: '#166534' },
  description: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, color: '#64748b' },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 40 },
});
