import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Scan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera access…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const onGrant = async () => {
      const r = await requestPermission();
      // If still denied after the request, the OS has remembered a previous
      // denial and won't prompt again — send the user to Settings directly.
      // openSettings is native-only; on web there's nothing to open.
      if (!r.granted && Platform.OS !== 'web') Linking.openSettings();
    };
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera access is required to scan badges.</Text>
        <Pressable style={styles.button} onPress={onGrant}>
          <Text style={styles.buttonText}>
            {permission.canAskAgain ? 'Grant access' : 'Open settings'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const trimmed = data.trim().toLowerCase();
          if (!UUID_RE.test(trimmed)) {
            setError('That QR is not a valid employee badge.');
            return;
          }
          handled.current = true;
          setError(null);
          router.replace({ pathname: '/(app)/confirm', params: { employeeId: trimmed } });
        }}
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>Align the badge QR inside the frame</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  msg: { textAlign: 'center', fontSize: 16 },
  button: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: 18, fontSize: 14 },
  errorBox: {
    position: 'absolute',
    bottom: 110,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(220,38,38,0.95)',
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  cancel: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
