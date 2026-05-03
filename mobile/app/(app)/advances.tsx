import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { CashAdvance, CashAdvanceStatus } from '@/lib/types';

type Row = CashAdvance & {
  applied_event: { id: string; title: string } | null;
};

const STATUS_PALETTE: Record<CashAdvanceStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#fef3c7', fg: '#a16207', label: 'PENDING' },
  applied: { bg: '#dcfce7', fg: '#166534', label: 'APPLIED' },
  deferred: { bg: '#dbeafe', fg: '#1e40af', label: 'DEFERRED' },
  cancelled: { bg: '#e2e8f0', fg: '#475569', label: 'CANCELLED' },
};

function formatPHP(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(s: string): string {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Advances() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('cash_advances')
      .select('*, applied_event:events(id, title)')
      .eq('user_id', profile.id)
      .order('advance_date', { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const totals = rows.reduce(
    (acc, r) => {
      const amount = Number(r.amount);
      if (r.status === 'pending') acc.pending += amount;
      if (r.status === 'applied') acc.applied += amount;
      if (r.status === 'deferred') acc.deferred += amount;
      return acc;
    },
    { pending: 0, applied: 0, deferred: 0 }
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>My advances</Text>
      <View style={styles.statRow}>
        <Stat label="Pending" value={totals.pending} />
        <Stat label="Applied" value={totals.applied} />
        <Stat label="Deferred" value={totals.deferred} />
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No cash advances on record.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const palette = STATUS_PALETTE[item.status];
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.amount}>₱{formatPHP(item.amount)}</Text>
                  <Text style={[styles.badge, { backgroundColor: palette.bg, color: palette.fg }]}>
                    {palette.label}
                  </Text>
                </View>
                <Text style={styles.date}>{formatDate(item.advance_date)}</Text>
                {item.status === 'applied' && item.applied_event && (
                  <Text style={styles.meta}>Applied to: {item.applied_event.title}</Text>
                )}
                {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>₱{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 18, fontWeight: '700' },
  badge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  date: { fontSize: 12, color: '#64748b' },
  meta: { fontSize: 12, color: '#475569' },
  notes: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 40 },
});
