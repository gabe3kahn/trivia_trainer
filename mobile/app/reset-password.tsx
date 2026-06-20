import { useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/src/services/supabase';
import { colors } from '@/src/theme';

// The recovery email opens the app at trivio://reset-password with the tokens in
// the URL fragment (implicit flow; detectSessionInUrl is off, so we parse them
// ourselves). Handles both fragment (#) and query (?) just in case.
function parseRecoveryTokens(url: string | null) {
  if (!url) return null;
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(hash || query);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { access_token, refresh_token };
  return null;
}

export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const tokens = useMemo(() => parseRecoveryTokens(url), [url]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // Establish the recovery session from the link (or use one already set).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (active) setReady(true);
        return;
      }
      if (tokens) {
        const { error: sessionError } = await supabase.auth.setSession(tokens);
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        else setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [tokens]);

  async function save() {
    if (password.length < 6) {
      Alert.alert('Too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      Alert.alert('Could not update password', updateError.message);
      return;
    }
    Alert.alert('Password updated', 'Sign in with your new password.', [
      {
        text: 'OK',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        {error ? null : <ActivityIndicator color={colors.gold} />}
        <Text style={styles.muted}>{error ?? 'Opening your reset link…'}</Text>
        {error ? (
          <Pressable onPress={() => router.replace('/auth')} style={styles.switchButton}>
            <Text style={styles.switchText}>Back to sign in</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Enter a new password for your account.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            placeholderTextColor={colors.dim}
            secureTextEntry
            autoFocus
          />
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderTextColor={colors.dim}
            secureTextEntry
          />
          <Pressable style={styles.primaryButton} onPress={save} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>Update password</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background, padding: 20 },
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 24 },
  header: { gap: 8 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  form: { gap: 12 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: { minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
  primaryText: { color: colors.background, fontSize: 15, fontWeight: '900' },
  switchButton: { alignItems: 'center', paddingVertical: 8 },
  switchText: { color: colors.teal, fontSize: 14, fontWeight: '800' },
});
