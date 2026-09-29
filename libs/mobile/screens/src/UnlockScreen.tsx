import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { describeAutoLock, useAutoLockDelay } from '@myorganizer/mobile/core';
import { useAuth, WEB_APP_URL } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  InlineNotice,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  useIsOffline,
  useTheme,
} from '@myorganizer/mobile/ui';
import { describeBiometricAttempt } from './biometricUnlockMessages';
import {
  classifyUnlockFailure,
  describeUnlockFailure,
  formatRecoveryKeyForDisplay,
  stripRecoveryKeyWhitespace,
  type UnlockSecretMode,
} from './unlockErrorClassification';

const OFFLINE_NOTICE_MESSAGE = "You're offline — check your connection.";
const LOGOUT_CONFIRM_MESSAGE =
  'Logging out also removes Biometric Unlock from this device.';

/** Adds the third view this screen can show, beyond either secret's form. */
type UnlockScreenMode = UnlockSecretMode | 'no-vault';

/**
 * Prompts an authenticated User to unlock their Vault — by Biometric Unlock,
 * by passphrase, or by Recovery Key — and, on a 404 from either typed secret,
 * offers the No Vault Yet screen instead of an inline error.
 *
 * Biometric Unlock is additive and never a gate (ADR 0108 decision 2): where
 * it is on, the prompt is raised once the moment this screen appears — on a
 * cold start and again after an Auto-Lock — and a User who dismisses it is
 * left on exactly the screen they would have seen otherwise, with both typed
 * secrets in front of them and the button still there to try again.
 */
export function UnlockScreen(): React.JSX.Element {
  const { unlock, unlockWithRecoveryKey, biometric, lockReason } =
    useVaultSession();
  const { logout } = useAuth();
  const theme = useTheme();
  const offline = useIsOffline();
  const autoLockDelay = useAutoLockDelay();

  const [mode, setMode] = useState<UnlockScreenMode>('passphrase');
  const [lastAttempt, setLastAttempt] =
    useState<UnlockSecretMode>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(false);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);

  const canSubmitPassphrase = passphrase.length > 0 && !submitting;
  const canSubmitRecoveryKey = recoveryKey.length > 0 && !submitting;

  /**
   * Raise the platform prompt and unlock from the stored Master Key.
   *
   * It has a busy flag of its own rather than sharing `submitting`, because
   * `submitting` is what puts "Deriving your key…" on the passphrase button —
   * and a Biometric Unlock derives nothing. It reads a key that already
   * exists, which is the entire point of it, and a deriving state shown here
   * would be the interface claiming work that never happened.
   */
  const attemptBiometricUnlock = useCallback(async (): Promise<void> => {
    setCheckingBiometrics(true);
    setError(null);
    try {
      const attempt = await biometric.unlock();
      // `null` for a cancellation: the screen simply waits.
      setError(describeBiometricAttempt(attempt));
    } finally {
      setCheckingBiometrics(false);
    }
  }, [biometric]);

  // Once per appearance of this screen, and only once the keystore has
  // answered. A ref rather than state because re-rendering on it would be a
  // render caused by something the User cannot see.
  const promptRaised = useRef(false);
  useEffect(() => {
    if (promptRaised.current) return;
    if (biometric.state !== 'on') return;
    promptRaised.current = true;
    void attemptBiometricUnlock();
  }, [biometric.state, attemptBiometricUnlock]);

  /**
   * The one shape a fresh unlock attempt takes, whichever typed secret it
   * uses: mark which one, run it, and on failure either switch to the No Vault
   * Yet screen or show the classified message inline.
   */
  async function attemptUnlock(
    secret: UnlockSecretMode,
    run: () => Promise<void>,
  ): Promise<void> {
    setError(null);
    setSubmitting(true);
    setLastAttempt(secret);
    try {
      await run();
    } catch (err) {
      const failure = classifyUnlockFailure(err);
      if (failure === 'no-vault') {
        setMode('no-vault');
      } else {
        setError(describeUnlockFailure(failure, secret));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePassphraseSubmit(): Promise<void> {
    if (!canSubmitPassphrase) return;
    await attemptUnlock('passphrase', () => unlock(passphrase));
  }

  async function handleRecoveryKeySubmit(): Promise<void> {
    if (!canSubmitRecoveryKey) return;
    await attemptUnlock('recovery-key', () =>
      unlockWithRecoveryKey(recoveryKey),
    );
  }

  async function handleCheckAgain(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      if (lastAttempt === 'recovery-key') {
        await unlockWithRecoveryKey(recoveryKey);
      } else {
        await unlock(passphrase);
      }
    } catch (err) {
      const failure = classifyUnlockFailure(err);
      if (failure === 'no-vault') {
        // Still nothing to unlock — stay on this screen.
      } else {
        setMode(lastAttempt);
        setError(describeUnlockFailure(failure, lastAttempt));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const confirmLogoutSheet = (
    <ConfirmSheet
      visible={confirmLogoutVisible}
      title="Log out?"
      message={LOGOUT_CONFIRM_MESSAGE}
      confirmLabel="Log out"
      destructive
      onConfirm={() => {
        setConfirmLogoutVisible(false);
        void logout();
      }}
      onCancel={() => setConfirmLogoutVisible(false)}
    />
  );

  if (mode === 'no-vault') {
    return (
      <Screen>
        <View style={[styles.content, { gap: theme.spacing.md }]}>
          <EmptyState
            icon="lock"
            title="No vault yet"
            description="We didn't find a vault for your account on this device. Create one on the web, then check again here."
          />

          {offline && (
            <InlineNotice
              tone="warning"
              icon="offline"
              message={OFFLINE_NOTICE_MESSAGE}
            />
          )}
          {error != null && <InlineNotice tone="destructive" message={error} />}

          <Button
            label="Open the web app"
            onPress={() => void Linking.openURL(WEB_APP_URL)}
          />
          <Button
            label={submitting ? 'Checking…' : 'Check again'}
            variant="secondary"
            onPress={() => void handleCheckAgain()}
            disabled={submitting}
          />
          <Button
            label="Log out"
            variant="ghost"
            onPress={() => setConfirmLogoutVisible(true)}
            disabled={submitting}
          />
        </View>

        {confirmLogoutSheet}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <Text variant="titleLg">Unlock your vault</Text>

        {/* Why the User is here, when it was not their doing. A User who
            pressed Lock is told nothing, because they already know. */}
        {lockReason === 'auto-lock' && (
          <InlineNotice
            tone="neutral"
            icon="lock"
            message={describeAutoLock(autoLockDelay)}
          />
        )}

        <SegmentedControl
          segments={[
            { value: 'passphrase', label: 'Passphrase' },
            { value: 'recovery-key', label: 'Recovery key' },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError(null);
          }}
          accessibilityLabel="Unlock method"
        />

        {offline && (
          <InlineNotice
            tone="warning"
            icon="offline"
            message={OFFLINE_NOTICE_MESSAGE}
          />
        )}

        {mode === 'passphrase' ? (
          <>
            <Text variant="caption">
              Enter your passphrase to decrypt your data on this device.
            </Text>

            <TextField
              label="Passphrase"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              revealable
              revealLabel="passphrase"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              placeholder="Enter your passphrase"
              returnKeyType="go"
              onSubmitEditing={() => void handlePassphraseSubmit()}
            />

            {error != null && (
              <InlineNotice tone="destructive" message={error} />
            )}

            {biometric.state === 'on' && (
              <Button
                label="Unlock with biometrics"
                icon="biometric"
                variant="secondary"
                busy={checkingBiometrics}
                onPress={() => void attemptBiometricUnlock()}
              />
            )}

            <Button
              label={submitting ? 'Deriving your key…' : 'Unlock'}
              onPress={() => void handlePassphraseSubmit()}
              disabled={!canSubmitPassphrase}
            />
          </>
        ) : (
          <>
            <Text variant="caption">
              Enter your Recovery Key. Mobile doesn&apos;t offer a passphrase
              reset — set a new one on the web after unlocking here.
            </Text>

            <TextField
              label="Recovery key"
              value={formatRecoveryKeyForDisplay(recoveryKey)}
              onChangeText={(text) =>
                setRecoveryKey(stripRecoveryKeyWhitespace(text))
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              placeholder="Paste your recovery key"
              returnKeyType="go"
              onSubmitEditing={() => void handleRecoveryKeySubmit()}
            />

            {error != null && (
              <InlineNotice tone="destructive" message={error} />
            )}

            <Button
              label={submitting ? 'Unlocking…' : 'Unlock with recovery key'}
              onPress={() => void handleRecoveryKeySubmit()}
              disabled={!canSubmitRecoveryKey}
            />
          </>
        )}

        <Button
          label="Log out"
          variant="ghost"
          onPress={() => setConfirmLogoutVisible(true)}
          disabled={submitting}
        />
      </View>

      {confirmLogoutSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
