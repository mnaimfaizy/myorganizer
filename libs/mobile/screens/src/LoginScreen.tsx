import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  requestPasswordReset,
  useAuth,
  webAppPath,
} from '@myorganizer/mobile/feat-auth';
import {
  BrandMark,
  Button,
  InlineNotice,
  Screen,
  Text,
  TextField,
  useIsOffline,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  BackLink,
  EntryScroll,
  MutedIconTile,
  useHardwareBack,
} from './EntryParts';
import {
  describeLoginError,
  LOGIN_FAILURES,
  type LoginFailureCopy,
} from './loginErrorClassification';

/*
 * Lines the Entry sheets do not draw. Each is the shape of a drawn one — what
 * happened, then what to do — so the undrawn states read as the same screen.
 */
const ENTER_EMAIL_LINE = 'Enter your email.';
const ENTER_SECRET_LINE = 'Enter your password.';
const RESET_OFFLINE_LINE =
  'You’re offline. Connect to the internet to send the link.';
const RESET_FAILED_LINE = 'The link couldn’t be sent. Try again.';

type LoginScreenMode = 'sign-in' | 'forgot-password' | 'reset-sent';

/**
 * Sign in, and the two Forgot password views reached from it (Entry · Sign in
 * and Forgot sheets).
 *
 * On success the AuthProvider flips `status` to `authenticated` and the root
 * navigator swaps this screen out — no manual navigation needed here.
 *
 * Forgot password is a view of this screen rather than a route of its own:
 * both are reached only while `status !== 'authenticated'`, and nothing on
 * either side outlives leaving this screen.
 */
export function LoginScreen(): React.JSX.Element {
  const [mode, setMode] = useState<LoginScreenMode>('sign-in');
  const [email, setEmail] = useState('');

  const backToSignIn = useCallback(() => setMode('sign-in'), []);
  useHardwareBack(mode !== 'sign-in', backToSignIn);

  if (mode === 'forgot-password') {
    return (
      <ForgotPasswordView
        initialEmail={email.trim()}
        onBack={backToSignIn}
        onSent={() => setMode('reset-sent')}
      />
    );
  }

  if (mode === 'reset-sent') {
    return <ResetSentView onBack={backToSignIn} />;
  }

  return (
    <SignInView
      email={email}
      onEmailChange={setEmail}
      onForgotPassword={() => setMode('forgot-password')}
    />
  );
}

function SignInView({
  email,
  onEmailChange,
  onForgotPassword,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onForgotPassword: () => void;
}): React.JSX.Element {
  const { login } = useAuth();
  const theme = useTheme();
  const offline = useIsOffline();

  const [secret, setSecret] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [failure, setFailure] = useState<LoginFailureCopy | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (submitting || offline) return;
    const trimmedEmail = email.trim();
    const missingEmail = trimmedEmail.length === 0;
    const missingSecret = secret.length === 0;
    setEmailError(missingEmail ? ENTER_EMAIL_LINE : null);
    setSecretError(missingSecret ? ENTER_SECRET_LINE : null);
    setFailure(null);
    if (missingEmail || missingSecret) return;

    setSubmitting(true);
    try {
      await login(trimmedEmail, secret);
    } catch (err) {
      setFailure(describeLoginError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Offline is the one notice that is about now rather than about the last
  // attempt, so it replaces whatever that attempt said (Sign in · Offline).
  const notice: LoginFailureCopy | null = offline
    ? LOGIN_FAILURES.offline
    : failure?.placement === 'notice'
      ? failure
      : null;
  const credentialsError =
    failure?.placement === 'password' ? failure.message : null;

  function clearCredentialsError(): void {
    if (failure?.placement === 'password') setFailure(null);
  }

  return (
    <Screen>
      <EntryScroll>
        <View style={styles.fill}>
          {/* The sheet sets the lockup 32 below the status bar. */}
          <View style={[styles.row, { paddingTop: theme.spacing.xl }]}>
            <BrandMark lockup="inline" />
          </View>

          {/* 40 above the title (xl + sm); the title and its line sit 6
              apart, which rounds up to `sm`. */}
          <View
            style={{
              paddingTop: theme.spacing.xl + theme.spacing.sm,
              gap: theme.spacing.sm,
            }}
          >
            <Text variant="titleLg" accessibilityRole="header">
              Sign in
            </Text>
            <Text variant="bodySm" color="mutedForeground">
              Use the account you made on the web.
            </Text>
          </View>

          <View
            style={{
              paddingTop: theme.spacing.lg + theme.spacing.xs,
              gap: theme.spacing.md,
            }}
          >
            <TextField
              label="Email"
              value={email}
              onChangeText={(text) => {
                onEmailChange(text);
                setEmailError(null);
                clearCredentialsError();
              }}
              error={emailError ?? undefined}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              returnKeyType="next"
            />

            <TextField
              label="Password"
              value={secret}
              onChangeText={(text) => {
                setSecret(text);
                setSecretError(null);
                clearCredentialsError();
              }}
              error={secretError ?? credentialsError ?? undefined}
              secureTextEntry
              revealable
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleSubmit()}
            />
          </View>

          <View style={[styles.trailing, { marginRight: -theme.spacing.sm }]}>
            <Button
              label="Forgot password?"
              variant="link"
              size="compact"
              onPress={onForgotPassword}
            />
          </View>

          {notice !== null && (
            <View
              style={{
                paddingTop: theme.spacing.xs,
                paddingBottom: theme.spacing.sm + theme.spacing.xs,
              }}
            >
              <InlineNotice
                tone="warning"
                // The disabled-account line takes the red mark beside body
                // text; the others the amber one (Sign in sheets).
                iconColor={notice.mark === 'error' ? 'errorEdge' : undefined}
                message={notice.message}
              />
            </View>
          )}

          <View style={{ paddingTop: theme.spacing.sm }}>
            <Button
              label="Sign in"
              busy={submitting}
              disabled={offline}
              onPress={() => void handleSubmit()}
            />
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: theme.spacing.sm }]}>
          <Text variant="bodySm" color="mutedForeground">
            New here?
          </Text>
          <Button
            label="Create your account on the web"
            variant="link"
            size="compact"
            icon="external"
            iconPosition="trailing"
            accessibilityRole="link"
            accessibilityHint="Opens the web app in your browser"
            onPress={() => void Linking.openURL(webAppPath('/signup'))}
          />
        </View>
      </EntryScroll>
    </Screen>
  );
}

function ForgotPasswordView({
  initialEmail,
  onBack,
  onSent,
}: {
  initialEmail: string;
  onBack: () => void;
  onSent: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const offline = useIsOffline();

  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (submitting || offline) return;
    const trimmed = email.trim();
    setFailed(false);
    if (trimmed.length === 0) {
      setEmailError(ENTER_EMAIL_LINE);
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      onSent();
    } catch {
      // Never surfaced more specifically than this: distinguishing a
      // transport failure from anything else here would risk leaking
      // whether the email exists, which the confirmation must never do.
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  const notice = offline
    ? RESET_OFFLINE_LINE
    : failed
      ? RESET_FAILED_LINE
      : null;

  return (
    <Screen>
      <EntryScroll>
        <BackLink label="Sign in" onPress={onBack} />

        <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          <Text variant="titleLg" accessibilityRole="header">
            Reset your password
          </Text>
          <Text variant="bodySm" color="mutedForeground">
            Enter your account’s email. We’ll send a link, and you finish the
            reset on the web.
          </Text>
        </View>

        <View style={{ paddingTop: theme.spacing.lg + theme.spacing.xs }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError(null);
            }}
            error={emailError ?? undefined}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            returnKeyType="send"
            onSubmitEditing={() => void handleSubmit()}
          />
        </View>

        {notice !== null && (
          <View style={{ paddingTop: theme.spacing.md }}>
            <InlineNotice
              tone="warning"
              iconColor={offline ? undefined : 'errorEdge'}
              message={notice}
            />
          </View>
        )}

        <View style={{ paddingTop: theme.spacing.lg }}>
          <Button
            label="Send reset link"
            busy={submitting}
            disabled={offline}
            onPress={() => void handleSubmit()}
          />
        </View>
      </EntryScroll>
    </Screen>
  );
}

/**
 * The confirmation (Forgot · Sent). It reads the same whether or not the
 * email has an account — the request's own answer is never shown — so it
 * cannot be used to learn who is signed up.
 */
function ResetSentView({ onBack }: { onBack: () => void }): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen>
      <EntryScroll>
        <BackLink label="Sign in" onPress={onBack} />

        {/* Centred in what is left, lifted 80 off the foot (xl × 2 + md). */}
        <View
          style={[
            styles.centredBlock,
            {
              gap: theme.spacing.sm + theme.spacing.xs,
              paddingBottom: theme.spacing.xl * 2 + theme.spacing.md,
            },
          ]}
        >
          <MutedIconTile icon="mail" />
          <Text
            variant="title"
            accessibilityRole="header"
            style={[styles.centredText, { marginTop: theme.spacing.sm }]}
          >
            Check your email
          </Text>
          <Text variant="body" style={[styles.centredText, styles.lead]}>
            If an account exists, a reset link is on its way. Finish the reset
            on the web.
          </Text>
          <Text variant="caption" style={[styles.centredText, styles.aside]}>
            The link opens in your browser. Come back and sign in with your new
            password.
          </Text>
        </View>

        <View style={{ paddingBottom: theme.spacing.sm }}>
          <Button
            label="Back to sign in"
            variant="secondary"
            onPress={onBack}
          />
        </View>
      </EntryScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
  },
  trailing: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  footer: {
    alignItems: 'center',
  },
  centredBlock: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centredText: {
    textAlign: 'center',
  },
  // The sheet's measures for the two paragraphs, which keep each to two or
  // three lines on any width. Layout widths, not spacing — no token applies.
  lead: {
    maxWidth: 320,
  },
  aside: {
    maxWidth: 300,
  },
});
