import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    const name = fullName.trim();
    const mail = email.trim();
    if (!name) return Alert.alert('Missing info', 'Enter your full name.');
    if (!mail) return Alert.alert('Missing info', 'Enter your email.');
    if (password.length < 6)
      return Alert.alert('Weak password', 'Password must be at least 6 characters.');
    if (password !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { full_name: name } },
    });
    setBusy(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data.session) {
      // Email confirmation is disabled — user is signed in. The auth provider
      // will detect the missing profile and create a pending row on the next
      // render, which routes them to the "Awaiting approval" home.
      router.replace('/(app)');
      return;
    }

    // Email confirmation is on — user has to click the link before they can sign in.
    Alert.alert(
      'Check your email',
      "We sent a confirmation link to " +
        mail +
        '. Open it to verify your address, then come back and sign in. Your account will be in pending status until an admin approves you.'
    );
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Sign up to enroll. An admin will review and activate your account before you can clock in.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#64748b"
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (6+ characters)"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            editable={!busy}
          />

          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
          </Pressable>

          <View style={styles.signinRow}>
            <Text style={styles.signinHint}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable disabled={busy}>
                <Text style={styles.signinLink}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  card: { gap: 12 },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center' },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 16, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signinRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  signinHint: { color: '#94a3b8', fontSize: 14 },
  signinLink: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
});
