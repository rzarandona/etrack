import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { discardAllPending, discardPending, flush, listPending } from '@/lib/queue';
import type { PendingScan } from '@/lib/types';

export default function Pending() {
  const { session } = useAuth();
  const [items, setItems] = useState<PendingScan[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await listPending());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onSync = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const synced = await flush(session.user.id);
      await refresh();
      Alert.alert('Sync', `${synced} scan(s) uploaded.`);
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscardOne = (item: PendingScan) => {
    Alert.alert(
      'Discard scan?',
      'This time/attendance record will NOT be uploaded. The data is lost. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardPending(item.client_scan_id);
            await refresh();
          },
        },
      ]
    );
  };

  const confirmDiscardAll = () => {
    Alert.alert(
      `Discard all ${items.length} pending scans?`,
      'None of them will be uploaded. The data is lost. Use only when scans are stuck and can’t recover. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard all',
          style: 'destructive',
          onPress: async () => {
            const n = await discardAllPending();
            await refresh();
            Alert.alert('Discarded', `${n} scan(s) removed.`);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(s) => s.client_scan_id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={<Text style={styles.empty}>Nothing pending.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {item.scan_type.toUpperCase()} · {item.employee_id.slice(0, 8)}
              </Text>
              <Text style={styles.meta}>queued {new Date(item.queued_at).toLocaleString()}</Text>
              {item.last_error && <Text style={styles.err}>err: {item.last_error}</Text>}
            </View>
            <Text style={styles.attempts}>x{item.attempts}</Text>
            <Pressable
              hitSlop={10}
              onPress={() => confirmDiscardOne(item)}
              style={styles.discardBtn}>
              <Text style={styles.discardBtnText}>Discard</Text>
            </Pressable>
          </View>
        )}
      />
      {items.length > 0 && (
        <View style={styles.footer}>
          <Pressable style={styles.sync} onPress={onSync} disabled={busy}>
            <Text style={styles.syncText}>{busy ? 'Syncing…' : 'Sync now'}</Text>
          </Pressable>
          <Pressable
            style={styles.discardAll}
            onPress={confirmDiscardAll}
            disabled={busy}>
            <Text style={styles.discardAllText}>Discard all</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  sep: { height: 1, backgroundColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  title: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, color: '#64748b' },
  err: { fontSize: 12, color: '#dc2626' },
  attempts: { fontSize: 12, color: '#64748b' },
  discardBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  discardBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 40 },
  footer: { gap: 10 },
  sync: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  syncText: { color: '#fff', fontWeight: '700' },
  discardAll: { paddingVertical: 12, alignItems: 'center' },
  discardAllText: { color: '#dc2626', fontWeight: '600' },
});
