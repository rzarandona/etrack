import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { getCachedEmployee } from '@/lib/directory';
import { enqueue, flush } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import type { Employee, ScanType } from '@/lib/types';
import { uuidv4 } from '@/lib/uuid';

const PHOTO_DIR = `${FileSystem.documentDirectory}etrack/photos/`;

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

export default function Confirm() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [coords, setCoords] = useState<Location.LocationObject | null>(null);
  const [scanType, setScanType] = useState<ScanType>('in');
  const [scanTypeUnknown, setScanTypeUnknown] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const wasSubmittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let emp = await getCachedEmployee(employeeId);
        if (!emp) {
          const { data, error: empErr } = await supabase
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .eq('active', true)
            .single();
          if (empErr || !data) {
            throw new Error(
              'Employee not found in offline cache. Connect to the internet on the home screen to refresh the directory, then try again.'
            );
          }
          emp = data as Employee;
        }
        if (cancelled) return;
        setEmployee(emp);

        try {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const { data: last, error: lastErr } = await supabase
            .from('scans')
            .select('scan_type')
            .eq('employee_id', employeeId)
            .gte('server_timestamp', startOfDay.toISOString())
            .order('server_timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastErr) throw lastErr;
          if (!cancelled) {
            setScanType(last?.scan_type === 'in' ? 'out' : 'in');
            setScanTypeUnknown(false);
          }
        } catch {
          // offline or query failed — keep the default 'in' but flag it as
          // unverified so the supervisor knows to double-check the toggle.
          if (!cancelled) setScanTypeUnknown(true);
        }

        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          throw new Error('Location permission denied. Enable location to record scans.');
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!cancelled) setCoords(pos);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    return () => {
      if (photoUri && !wasSubmittedRef.current) {
        FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
    };
  }, [photoUri]);

  const blockReason: string | null = useMemo(() => {
    if (!coords) return null;
    if (coords.mocked === true) {
      return 'Mock location detected. Turn off any mock-location app and try again.';
    }
    return null;
  }, [coords]);

  const openCamera = async () => {
    if (!cameraPerm?.granted) {
      const r = await requestCameraPerm();
      if (!r.granted) {
        const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [
          { text: 'Cancel', style: 'cancel' },
        ];
        if (Platform.OS !== 'web') {
          buttons.push({ text: 'Open Settings', onPress: () => Linking.openSettings() });
        }
        Alert.alert(
          'Camera blocked',
          'Enable camera access in Settings to take a verification photo.',
          buttons
        );
        return;
      }
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (!pic) return;
      await ensurePhotoDir();
      const dest = `${PHOTO_DIR}${uuidv4()}.jpg`;
      await FileSystem.moveAsync({ from: pic.uri, to: dest });

      if (photoUri) {
        await FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
      setPhotoUri(dest);
      setShowCamera(false);
    } catch (e) {
      Alert.alert('Capture failed', (e as Error).message);
    } finally {
      setCapturing(false);
    }
  };

  const removePhoto = async () => {
    if (!photoUri) return;
    await FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
    setPhotoUri(null);
  };

  const onSubmit = async () => {
    if (!employee || !coords || !session) return;
    if (blockReason) {
      Alert.alert('Cannot submit', blockReason);
      return;
    }
    setSubmitting(true);
    try {
      await enqueue({
        client_scan_id: uuidv4(),
        employee_id: employee.id,
        // event_id and phase_id will be populated in Phase 2 once event pickers
        // land on this screen. For now scans go in unscoped.
        event_id: null,
        phase_id: null,
        scan_type: scanType,
        device_timestamp: new Date().toISOString(),
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
        accuracy_m: coords.coords.accuracy ?? null,
        is_mock_location: coords.mocked === true,
        self_clocked: false,
        local_photo_uri: photoUri,
        queued_at: new Date().toISOString(),
        attempts: 0,
        last_error: null,
      });
      wasSubmittedRef.current = true;
      const synced = await flush(session.user.id);
      Alert.alert(
        'Scan recorded',
        synced > 0
          ? `${employee.full_name} clocked ${scanType.toUpperCase()}.`
          : `${employee.full_name}: queued offline, will sync later.`
      );
      router.replace('/(app)');
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Loading badge & GPS…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!employee || !coords) return null;

  if (showCamera) {
    return (
      <View style={styles.cameraRoot}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraControls}>
          <Pressable style={styles.cameraCancel} onPress={() => setShowCamera(false)}>
            <Text style={styles.cameraCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.shutter} onPress={capturePhoto} disabled={capturing}>
            {capturing ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={{ width: 70 }} />
        </View>
      </View>
    );
  }

  const submitDisabled = submitting || blockReason !== null;

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.empName}>{employee.full_name}</Text>
      <Text style={styles.empCode}>{employee.employee_code}</Text>

      <View style={styles.toggleRow}>
        {(['in', 'out'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.toggle, scanType === t && (t === 'in' ? styles.toggleIn : styles.toggleOut)]}
            onPress={() => setScanType(t)}>
            <Text style={[styles.toggleText, scanType === t && styles.toggleTextActive]}>
              {t === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}
            </Text>
          </Pressable>
        ))}
      </View>

      {scanTypeUnknown && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            Couldn&apos;t check today&apos;s scans (offline?). Verify In/Out manually before submit.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>
          {coords.coords.latitude.toFixed(5)}, {coords.coords.longitude.toFixed(5)}
        </Text>
        <Text style={styles.meta}>accuracy ±{coords.coords.accuracy?.toFixed(0) ?? '?'} m</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Verification photo (optional)</Text>
        {photoUri ? (
          <View style={styles.photoPreviewRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <View style={{ gap: 8 }}>
              <Pressable style={styles.photoBtn} onPress={openCamera}>
                <Text style={styles.photoBtnText}>Retake</Text>
              </Pressable>
              <Pressable style={[styles.photoBtn, styles.photoBtnDanger]} onPress={removePhoto}>
                <Text style={[styles.photoBtnText, { color: '#dc2626' }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.photoCta} onPress={openCamera}>
            <Text style={styles.photoCtaText}>Take photo of employee</Text>
          </Pressable>
        )}
      </View>

      {blockReason && (
        <View style={styles.blockBanner}>
          <Text style={styles.blockText}>{blockReason}</Text>
        </View>
      )}

      <Pressable
        style={[styles.submit, submitDisabled && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={submitDisabled}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit {scanType.toUpperCase()}</Text>
        )}
      </Pressable>

      <Pressable style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  error: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  empName: { fontSize: 28, fontWeight: '700' },
  empCode: { fontSize: 14, color: '#64748b' },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  toggleIn: { backgroundColor: '#16a34a' },
  toggleOut: { backgroundColor: '#dc2626' },
  toggleText: { fontWeight: '700', color: '#475569', letterSpacing: 0.5 },
  toggleTextActive: { color: '#fff' },
  section: { gap: 4 },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 12, color: '#64748b' },
  photoCta: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },
  photoCtaText: { color: '#475569', fontWeight: '500' },
  photoPreviewRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  photoThumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: '#000' },
  photoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  photoBtnDanger: { backgroundColor: '#fee2e2' },
  photoBtnText: { fontWeight: '600', color: '#475569' },
  blockBanner: {
    backgroundColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
  },
  blockText: { color: '#991b1b', fontWeight: '500', fontSize: 14, lineHeight: 20 },
  warnBanner: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
    padding: 10,
    borderRadius: 8,
  },
  warnText: { color: '#92400e', fontSize: 13, lineHeight: 18 },
  submit: {
    marginTop: 4,
    backgroundColor: '#0f172a',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#64748b', fontSize: 14 },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  cameraControls: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cameraCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  cameraCancelText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
