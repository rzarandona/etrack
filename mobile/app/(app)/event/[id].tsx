import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { getMyEmployee } from '@/lib/employee';
import { supabase } from '@/lib/supabase';
import type { Employee, EventPhase, EventRecord, ScanType } from '@/lib/types';

type LastScan = { phase_id: string | null; scan_type: ScanType };

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [phases, setPhases] = useState<EventPhase[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [lastByPhase, setLastByPhase] = useState<Record<string, ScanType>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    setError(null);

    try {
      const [{ data: ev }, { data: ph }] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase.from('event_phases').select('*').eq('event_id', id).order('ord'),
      ]);
      if (!ev) throw new Error('Event not found or you do not have access.');
      setEvent(ev as EventRecord);
      setPhases((ph as EventPhase[]) ?? []);

      // Resolve the caller's employee record (if any) for self-clock-in.
      if (profile.role === 'employee') {
        const me = await getMyEmployee(profile.id);
        setEmployee(me);

        if (me) {
          // Pull this employee's most-recent scan per phase to compute toggle state.
          const { data: scans } = await supabase
            .from('scans')
            .select('phase_id, scan_type, server_timestamp')
            .eq('event_id', id)
            .eq('employee_id', me.id)
            .order('server_timestamp', { ascending: false });

          const seen: Record<string, ScanType> = {};
          for (const s of (scans as LastScan[]) ?? []) {
            if (s.phase_id && !seen[s.phase_id]) seen[s.phase_id] = s.scan_type;
          }
          setLastByPhase(seen);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Event not found.'}</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const isEmployee = profile?.role === 'employee';
  const canClockIn = isEmployee && employee !== null;

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>
        {new Date(event.starts_at).toLocaleString()}
        {event.ends_at && ` → ${new Date(event.ends_at).toLocaleString()}`}
      </Text>
      {event.venue && <Text style={styles.meta}>📍 {event.venue}</Text>}

      <Text style={styles.sectionTitle}>Phases</Text>

      {phases.length === 0 && <Text style={styles.empty}>No phases configured.</Text>}

      {phases.map((p) => {
        const last = lastByPhase[p.id];
        const nextAction: ScanType = last === 'in' ? 'out' : 'in';
        return (
          <View key={p.id} style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseName}>
                  {p.ord}. {p.name}
                </Text>
                {(p.starts_at || p.ends_at) && (
                  <Text style={styles.phaseMeta}>
                    {p.starts_at ? new Date(p.starts_at).toLocaleString() : '—'} →{' '}
                    {p.ends_at ? new Date(p.ends_at).toLocaleString() : '—'}
                  </Text>
                )}
                {p.pay_rate && <Text style={styles.phaseMeta}>Pay: {p.pay_rate}/phase</Text>}
              </View>
              {last && <StatusChip type={last} />}
            </View>
            {canClockIn && (
              <Pressable
                style={[
                  styles.actionBtn,
                  nextAction === 'in' ? styles.actionIn : styles.actionOut,
                ]}
                onPress={() =>
                  router.push(
                    `/(app)/event/${event.id}/clock-in?phase=${p.id}&type=${nextAction}` as never
                  )
                }>
                <Text style={styles.actionText}>
                  {nextAction === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}
                </Text>
              </Pressable>
            )}
            {!canClockIn && isEmployee && !employee && (
              <Text style={styles.muted}>Your account isn&apos;t linked to an employee record yet.</Text>
            )}
            {!isEmployee && (
              <Text style={styles.muted}>
                Supervisor view: scan a badge from the home screen to clock in employees.
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function StatusChip({ type }: { type: ScanType }) {
  const isIn = type === 'in';
  return (
    <Text
      style={{
        backgroundColor: isIn ? '#dcfce7' : '#fee2e2',
        color: isIn ? '#166534' : '#991b1b',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 11,
        fontWeight: '700',
      }}>
      {isIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  error: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 13, color: '#64748b' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 12 },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 20 },
  phaseCard: {
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  phaseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  phaseName: { fontSize: 16, fontWeight: '700' },
  phaseMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionIn: { backgroundColor: '#16a34a' },
  actionOut: { backgroundColor: '#dc2626' },
  actionText: { color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
  muted: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
});
