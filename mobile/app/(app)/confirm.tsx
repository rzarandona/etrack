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
import { getCachedEmployee, getCachedSites } from '@/lib/directory';
import { haversineMeters } from '@/lib/geo';
import { enqueue, flush } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import type { Employee, ScanType, Site } from '@/lib/types';
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
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [coords, setCoords] = useState<Location.LocationObject | null>(null);
  const [scanType, setScanType] = useState<ScanType>('in');
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
        // 1) Employee — try local directory cache first so offline scans work.
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

        // 2) Default in/out — only meaningful when online; default to 'in' offline.
        try {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const { data: last } = await supabase
            .from('scans')
            .select('scan_type')
            .eq('employee_id', employeeId)
            .gte('server_timestamp', startOfDay.toISOString())
            .order('server_timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cancelled) setScanType(last?.scan_type === 'in' ? 'out' : 'in');
        } catch {
          // offline — leave the default 'in', supervisor can override
        }

        // 3) Sites — read from cache. Empty array is fine (off-site only).
        const cachedSites = await getCachedSites();
        if (!cancelled) setSites(cachedSites);

        // 4) GPS — required for every scan, online or offline.
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

  // Clean up captured photo if the user backs out without submitting.
  // Once submitted, the queue owns the file and will delete it after upload.
  useEffect(() => {
    return () => {
      if (photoUri && !wasSubmittedRef.current) {
        FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
    };
  }, [photoUri]);

  const selectedSite = useMemo(
    () => (siteId ? sites.find((s) => s.id === siteId) ?? null : null),
    [siteId, sites]
  );

  const blockReason: string | null = useMemo(() => {
    if (!coords) return null;
    if (coords.mocked === true) {
      return 'Mock location detected. Turn off any mock-location app and try again.';
    }
    if (
      selectedSite &&
      selectedSite.latitude &&
      selectedSite.longitude &&
      selectedSite.geofence_radius_m
    ) {
      const distance = haversineMeters(
        { latitude: coords.coords.latitude, longitude: coords.coords.longitude },
        {
          latitude: parseFloat(selectedSite.latitude),
          longitude: parseFloat(selectedSite.longitude),
        }
      );
      if (distance > selectedSite.geofence_radius_m) {
        return `Outside ${selectedSite.name}: you are ${Math.round(distance)} m away, allowed ${selectedSite.geofence_radius_m} m. Move closer or pick "Off-site".`;
      }
    }
    return null;
  }, [coords, selectedSite]);

  const openCamera = async () => {
    if (!cameraPerm?.granted) {
      const r = await requestCameraPerm();
      if (!r.granted) {
        // OS has remembered a prior denial — send to Settings directly.
        // openSettings is native-only; on web fall back to a plain alert.
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

      // Replace any previous photo
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
        site_id: siteId,
        scan_type: scanType,
        device_timestamp: new Date().toISOString(),
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
        accuracy_m: coords.coords.accuracy ?? null,
        is_mock_location: coords.mocked === true,
        local_photo_uri: photoUri,
        queued_at: new Date().toISOString(),
        attempts: 0,
        last_error: null,
      });
      wasSubmittedRef.current = true; // queue now owns the photo file
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

      <View style={styles.section}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>
          {coords.coords.latitude.toFixed(5)}, {coords.coords.longitude.toFixed(5)}
        </Text>
        <Text style={styles.meta}>accuracy ±{coords.coords.accuracy?.toFixed(0) ?? '?'} m</Text>
      </View>

      {sites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Site (optional)</Text>
          <View style={styles.siteRow}>
            <Pressable
              style={[styles.sitePill, siteId === null && styles.sitePillActive]}
              onPress={() => setSiteId(null)}>
              <Text style={[styles.sitePillText, siteId === null && styles.sitePillTextActive]}>
                Off-site
              </Text>
            </Pressable>
            {sites.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.sitePill, siteId === s.id && styles.sitePillActive]}
                onPress={() => setSiteId(s.id)}>
                <Text style={[styles.sitePillText, siteId === s.id && styles.sitePillTextActive]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

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
  siteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  sitePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  sitePillActive: { backgroundColor: '#2563eb' },
  sitePillText: { color: '#475569', fontWeight: '500' },
  sitePillTextActive: { color: '#fff' },
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
  // Camera mode
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
