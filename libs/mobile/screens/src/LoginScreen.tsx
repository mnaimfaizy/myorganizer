import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  ScreenContainer,
  ThemedText,
  ThemedInput,
  ThemedButton,
  useTheme,
} from '@myorganizer/mobile/ui';

/**
 * Maps a thrown login error to user-facing copy. An error carrying an HTTP
 * `response` means the server rejected the request (bad credentials); the
 * absence of a response means the request never completed (network/offline).
 */
function describeLoginError(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status != null) {
    if (status === 400 || status === 401 || status === 422) {
      return 'Incorrect email or password.';
    }
    return 'Sign in failed. Please try again.';
  }
  return 'Network error — check your connection and try again.';
}

/**
 * Collects email + password and authenticates via the mobile auth module.
 * On success the AuthProvider flips `status` to `authenticated` and the root
 * navigator swaps this screen out — no manual navigation needed here.
 */
export function LoginScreen(): React.JSX.Element {
  const { login } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(describeLoginError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <ThemedText variant="heading">Sign in</ThemedText>
        <ThemedText variant="caption">
          Access your MyOrganizer account.
        </ThemedText>

        <ThemedInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!submitting}
          placeholder="you@example.com"
        />

        <ThemedInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          editable={!submitting}
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
        />

        {error != null && (
          <ThemedText variant="caption" color="destructive">
            {error}
          </ThemedText>
        )}

        <ThemedButton
          label={submitting ? 'Signing in…' : 'Sign in'}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{ marginTop: theme.spacing.sm }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
