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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { getMyEmployee } from '@/lib/employee';
import { enqueue, flush } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import type { Employee, EventPhase, EventRecord, ScanType } from '@/lib/types';
import { uuidv4 } from '@/lib/uuid';

const PHOTO_DIR = `${FileSystem.documentDirectory}etrack/photos/`;

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/**
 * Employee selfie clock-in / clock-out for a specific (event, phase) pair.
 * Selfie photo is captured with the FRONT camera to verify identity.
 */
export default function EmployeeClockIn() {
  const params = useLocalSearchParams<{ id: string; phase: string; type: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();

  const eventId = params.id;
  const phaseId = params.phase;
  const scanType: ScanType = params.type === 'out' ? 'out' : 'in';

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [phase, setPhase] = useState<EventPhase | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [coords, setCoords] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const wasSubmittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!profile) throw new Error('Not signed in.');

        const me = await getMyEmployee(profile.id);
        if (!me) throw new Error('Your account is not linked to an employee record.');
        if (cancelled) return;
        setEmployee(me);

        const [{ data: ev }, { data: ph }] = await Promise.all([
          supabase.from('events').select('*').eq('id', eventId).single(),
          supabase.from('event_phases').select('*').eq('id', phaseId).single(),
        ]);
        if (!ev || !ph) throw new Error('Event or phase not found.');
        if (cancelled) return;
        setEvent(ev as EventRecord);
        setPhase(ph as EventPhase);

        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          throw new Error('Location permission denied. Enable location to clock in.');
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
  }, [eventId, phaseId, profile]);

  // Clean up an unsaved photo on unmount.
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
          'Enable camera access in Settings to take a selfie verification photo.',
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
    if (!employee || !coords || !profile || !event || !phase) return;
    if (blockReason) {
      Alert.alert('Cannot submit', blockReason);
      return;
    }
    setSubmitting(true);
    try {
      await enqueue({
        client_scan_id: uuidv4(),
        employee_id: employee.id,
        event_id: event.id,
        phase_id: phase.id,
        scan_type: scanType,
        device_timestamp: new Date().toISOString(),
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
        accuracy_m: coords.coords.accuracy ?? null,
        is_mock_location: coords.mocked === true,
        self_clocked: true,
        local_photo_uri: photoUri,
        queued_at: new Date().toISOString(),
        attempts: 0,
        last_error: null,
      });
      wasSubmittedRef.current = true;
      const synced = await flush(profile.id);
      Alert.alert(
        scanType === 'in' ? 'Clocked in' : 'Clocked out',
        synced > 0
          ? `${event.title} · ${phase.name}`
          : 'Queued offline — will sync when online.'
      );
      router.replace(`/(app)/event/${event.id}` as never);
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
        <Text style={{ marginTop: 12 }}>Preparing…</Text>
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

  if (!event || !phase || !employee || !coords) return null;

  if (showCamera) {
    return (
      <View style={styles.cameraRoot}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
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

  const submitDisabled = submitting || blockReason !== null || !photoUri;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        {scanType === 'in' ? 'Clock In' : 'Clock Out'}
      </Text>
      <Text style={styles.subtitle}>
        {event.title} · {phase.name}
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>
          {coords.coords.latitude.toFixed(5)}, {coords.coords.longitude.toFixed(5)}
        </Text>
        <Text style={styles.meta}>accuracy ±{coords.coords.accuracy?.toFixed(0) ?? '?'} m</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Selfie verification photo</Text>
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
            <Text style={styles.photoCtaText}>📷 Take a selfie</Text>
          </Pressable>
        )}
      </View>

      {blockReason && (
        <View style={styles.blockBanner}>
          <Text style={styles.blockText}>{blockReason}</Text>
        </View>
      )}

      <Pressable
        style={[
          styles.submit,
          scanType === 'in' ? styles.submitIn : styles.submitOut,
          submitDisabled && styles.submitDisabled,
        ]}
        onPress={onSubmit}
        disabled={submitDisabled}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            Submit {scanType === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}
          </Text>
        )}
      </Pressable>

      <Pressable style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  error: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#64748b' },
  section: { gap: 4 },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 12, color: '#64748b' },
  photoCta: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },
  photoCtaText: { color: '#475569', fontWeight: '600', fontSize: 16 },
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
  submit: { paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  submitIn: { backgroundColor: '#16a34a' },
  submitOut: { backgroundColor: '#dc2626' },
  submitDisabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
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
