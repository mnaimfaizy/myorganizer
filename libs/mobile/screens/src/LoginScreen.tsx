import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  requestPasswordReset,
  useAuth,
  webAppPath,
} from '@myorganizer/mobile/feat-auth';
import {
  Button,
  InlineNotice,
  Screen,
  Text,
  TextField,
  useIsOffline,
  useTheme,
} from '@myorganizer/mobile/ui';
import { describeLoginError } from './loginErrorClassification';

const OFFLINE_NOTICE_MESSAGE = "You're offline — check your connection.";
const RESET_CONFIRMATION_MESSAGE =
  "If an account exists for that email, we've sent instructions to reset the password. Finish resetting it on the web.";
const RESET_REQUEST_FAILED_MESSAGE =
  'Could not send the request. Check your connection and try again.';

type LoginScreenMode = 'sign-in' | 'forgot-password';

/**
 * Collects email + password and authenticates via the mobile auth module.
 * On success the AuthProvider flips `status` to `authenticated` and the root
 * navigator swaps this screen out — no manual navigation needed here.
 *
 * Also carries Forgot password as a view mode rather than a separate route:
 * both screens are reached only while `status !== 'authenticated'`, and
 * there is nothing on either side that outlives leaving this screen.
 */
export function LoginScreen(): React.JSX.Element {
  const { login } = useAuth();
  const theme = useTheme();
  const offline = useIsOffline();

  const [mode, setMode] = useState<LoginScreenMode>('sign-in');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

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

  function openForgotPassword(): void {
    setResetEmail(email.trim());
    setResetError(null);
    setResetSent(false);
    setMode('forgot-password');
  }

  function backToSignIn(): void {
    setMode('sign-in');
  }

  const canSubmitReset = resetEmail.trim().length > 0 && !resetSubmitting;

  async function handleRequestReset(): Promise<void> {
    if (!canSubmitReset) return;
    setResetError(null);
    setResetSubmitting(true);
    try {
      await requestPasswordReset(resetEmail.trim());
      setResetSent(true);
    } catch {
      // Never surfaced more specifically than this: distinguishing a
      // transport failure from anything else here would risk leaking
      // whether the email exists, which the confirmation must never do.
      setResetError(RESET_REQUEST_FAILED_MESSAGE);
    } finally {
      setResetSubmitting(false);
    }
  }

  if (mode === 'forgot-password') {
    return (
      <Screen>
        <View style={[styles.content, { gap: theme.spacing.md }]}>
          <Text variant="titleLg">Reset your password</Text>
          <Text variant="caption">
            Enter your email and we&apos;ll send instructions. Finishing the
            reset happens on the web.
          </Text>

          {offline && (
            <InlineNotice
              tone="warning"
              icon="offline"
              message={OFFLINE_NOTICE_MESSAGE}
            />
          )}

          {resetSent ? (
            <InlineNotice tone="neutral" message={RESET_CONFIRMATION_MESSAGE} />
          ) : (
            <>
              <TextField
                label="Email"
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!resetSubmitting}
                placeholder="you@example.com"
                returnKeyType="go"
                onSubmitEditing={() => void handleRequestReset()}
              />

              {resetError != null && (
                <InlineNotice tone="destructive" message={resetError} />
              )}

              <Button
                label={resetSubmitting ? 'Sending…' : 'Send reset link'}
                onPress={() => void handleRequestReset()}
                disabled={!canSubmitReset}
              />
            </>
          )}

          <Button
            label="Back to sign in"
            variant="ghost"
            onPress={backToSignIn}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <Text variant="titleLg">Sign in</Text>
        <Text variant="caption">Access your MyOrganizer account.</Text>

        {offline && (
          <InlineNotice
            tone="warning"
            icon="offline"
            message={OFFLINE_NOTICE_MESSAGE}
          />
        )}

        <TextField
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

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          revealable
          autoCapitalize="none"
          textContentType="password"
          editable={!submitting}
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
        />

        {error != null && <InlineNotice tone="destructive" message={error} />}

        <Button
          label={submitting ? 'Signing in…' : 'Sign in'}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{ marginTop: theme.spacing.sm }}
        />

        <Button
          label="Forgot password?"
          variant="ghost"
          onPress={openForgotPassword}
          disabled={submitting}
        />

        <Button
          label="Create your account on the web"
          variant="ghost"
          onPress={() => void Linking.openURL(webAppPath('/signup'))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
