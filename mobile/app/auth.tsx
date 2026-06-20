import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/services/supabase';
import { colors } from '@/src/theme';

export default function AuthScreen() {
  const { session } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Redirect href="/" />;
  }

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter an email and password.');
      return;
    }

    setLoading(true);
    const emailRedirectTo = Linking.createURL('auth-callback');
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo,
          },
        });
    setLoading(false);

    if (result.error) {
      Alert.alert('Auth error', result.error.message);
      return;
    }

    if (mode === 'sign-up' && !result.data.session) {
      Alert.alert('Check your email', 'Confirm your account, then sign in.');
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your account email above first, then tap “Forgot password?”.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('reset-password'),
    });
    setLoading(false);
    if (error) {
      Alert.alert('Could not send reset email', error.message);
      return;
    }
    Alert.alert('Check your email', 'We sent a link to reset your password. Open it on this device.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Trivia Trainer</Text>
          <Text style={styles.title}>{mode === 'sign-in' ? 'Welcome back' : 'Create account'}</Text>
          <Text style={styles.subtitle}>Sign in to save attempts, competency scores, review queue, and badges.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.dim}
            secureTextEntry
          />
          <Pressable style={styles.primaryButton} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>{mode === 'sign-in' ? 'Sign In' : 'Sign Up'}</Text>}
          </Pressable>
          {mode === 'sign-in' ? (
            <Pressable onPress={forgotPassword} disabled={loading} style={styles.forgotButton}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  kicker: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
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
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '800',
  },
});
