import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/theme';

export default function AuthCallbackScreen() {
  const { loading, session } = useAuth();

  if (!loading && session) {
    return <Redirect href="/" />;
  }

  if (!loading && !session) {
    return <Redirect href="/auth" />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.gold} />
      <Text style={styles.text}>Confirming account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
});
