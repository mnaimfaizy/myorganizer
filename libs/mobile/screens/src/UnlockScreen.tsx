import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { describeAutoLock, useAutoLockDelay } from '@myorganizer/mobile/core';
import { useAuth, WEB_APP_URL } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  ConfirmSheet,
  Icon,
  InlineNotice,
  Screen,
  Text,
  TextField,
  useIsOffline,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  biometricCopyFor,
  describeBiometricAttempt,
  type BiometricMethodCopy,
} from './biometricUnlockMessages';
import {
  BackLink,
  BrandBadge,
  EntryScroll,
  OrDivider,
  useHardwareBack,
} from './EntryParts';
import {
  classifyUnlockFailure,
  describeUnlockFailure,
  formatRecoveryKeyForDisplay,
  stripRecoveryKeyWhitespace,
  UNLOCK_OFFLINE_MESSAGE,
  type UnlockFailure,
  type UnlockSecretMode,
} from './unlockErrorClassification';

/** Unlock's Log out confirmation — the same two paragraphs Account's says. */
const LOGOUT_CONFIRM_MESSAGE = [
  'Logging out also removes Biometric Unlock from this device.',
  'Your Vault stays on the server. Sign in again with your email and password.',
] as const;

/*
 * Lines the Entry sheets do not draw. Each is the shape of a drawn one — what
 * happened, then what to do — so the undrawn states read as the same screen.
 */
const ENTER_SECRET_LINE = 'Enter your passphrase.';
const CHECK_AGAIN_OFFLINE_LINE =
  'You’re offline. Connect to the internet to check again.';

const DERIVING_LINE = 'Unlocking — this takes about a second.';
const STILL_NO_VAULT_LINE =
  'Still no Vault on this account. Finish setting it up on the web, then check again.';

/**
 * The Recovery Key field's face. The sheet sets the key in a monospace so the
 * eleven groups of four line up; no token carries a monospace family, so this
 * is each platform's own system monospace.
 */
const RECOVERY_KEY_FONT = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});

/** The sheet's tracking on the key, as a fraction of its size. */
const RECOVERY_KEY_TRACKING = 0.04;

/** Adds the third view this screen can show, beyond either secret's form. */
type UnlockScreenMode = UnlockSecretMode | 'no-vault';

/** A failure that is not about the typed secret — shown as a line, not on the field. */
interface UnlockNotice {
  message: string;
  /** The offline line takes the amber mark; a failed load the red one. */
  mark: 'warning' | 'error';
}

/**
 * Where an attempt's failure goes: a wrong secret onto the field it was typed
 * in, anything else onto a line above it. `no-vault` never reaches here — it
 * changes the view instead.
 */
function noticeFor(failure: UnlockFailure): UnlockNotice | null {
  if (failure === 'network') {
    return { message: UNLOCK_OFFLINE_MESSAGE, mark: 'warning' };
  }
  if (failure === 'server-error') {
    return {
      message: describeUnlockFailure(failure, 'passphrase'),
      mark: 'error',
    };
  }
  return null;
}

/**
 * Prompts an authenticated User to unlock their Vault — by Biometric Unlock,
 * by passphrase, or by Recovery Key — and, on a 404 from either typed secret,
 * shows the No Vault yet view instead of an inline error (Entry · Unlock,
 * Recovery and No Vault sheets).
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
  const { logout, user } = useAuth();
  const offline = useIsOffline();

  const [mode, setMode] = useState<UnlockScreenMode>('passphrase');
  const [lastAttempt, setLastAttempt] =
    useState<UnlockSecretMode>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [secretError, setSecretError] = useState<string | null>(null);
  const [notice, setNotice] = useState<UnlockNotice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stillNoVault, setStillNoVault] = useState(false);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);

  const [bioCancelled, setBioCancelled] = useState(false);
  const [bioNotice, setBioNotice] = useState<string | null>(null);
  // A ref, not state: it only has to stop a second prompt being raised over
  // the first, and a re-render to say so would be a render nobody sees.
  const checkingBiometrics = useRef(false);

  function clearFeedback(): void {
    setSecretError(null);
    setNotice(null);
  }

  /**
   * Raise the platform prompt and unlock from the stored Master Key.
   *
   * It never touches `submitting`, because `submitting` is what puts the
   * deriving line on the screen — and a Biometric Unlock derives nothing. It
   * reads a key that already exists, which is the entire point of it, and a
   * deriving state shown here would be the interface claiming work that
   * never happened.
   *
   * A cancellation says so only when the User pressed the button: the prompt
   * raised on arrival that they dismissed was their answer, and the screen
   * simply waits (Entry · Locked, step 4). One they asked for and then
   * dismissed gets the quiet line under the button (Unlock · Cancelled).
   */
  const attemptBiometricUnlock = useCallback(
    async (askedByUser: boolean): Promise<void> => {
      if (checkingBiometrics.current) return;
      checkingBiometrics.current = true;
      setBioCancelled(false);
      setBioNotice(null);
      setNotice(null);
      try {
        const attempt = await biometric.unlock();
        if (attempt.outcome === 'cancelled') {
          setBioCancelled(askedByUser);
          return;
        }
        setBioNotice(describeBiometricAttempt(attempt));
      } finally {
        checkingBiometrics.current = false;
      }
    },
    [biometric],
  );

  // Once per appearance of this screen, and only once the keystore has
  // answered and there is a connection to unlock over. A ref rather than
  // state because re-rendering on it would be a render caused by something
  // the User cannot see.
  const promptRaised = useRef(false);
  useEffect(() => {
    if (promptRaised.current) return;
    if (biometric.state !== 'on' || offline) return;
    promptRaised.current = true;
    void attemptBiometricUnlock(false);
  }, [biometric.state, offline, attemptBiometricUnlock]);

  /**
   * The one shape a fresh unlock attempt takes, whichever typed secret it
   * uses: mark which one, run it, and on failure either switch to the No Vault
   * yet view or put the classified message where it belongs.
   */
  async function attemptUnlock(
    secret: UnlockSecretMode,
    run: () => Promise<void>,
  ): Promise<void> {
    clearFeedback();
    setBioCancelled(false);
    setSubmitting(true);
    setLastAttempt(secret);
    try {
      await run();
    } catch (err) {
      const failure = classifyUnlockFailure(err);
      if (failure === 'no-vault') {
        setStillNoVault(false);
        setMode('no-vault');
      } else if (failure === 'wrong-secret') {
        setSecretError(describeUnlockFailure(failure, secret));
      } else {
        setNotice(noticeFor(failure));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePassphraseSubmit(): Promise<void> {
    if (submitting || offline) return;
    if (passphrase.length === 0) {
      setSecretError(ENTER_SECRET_LINE);
      return;
    }
    await attemptUnlock('passphrase', () => unlock(passphrase));
  }

  async function handleRecoveryKeySubmit(): Promise<void> {
    if (submitting || offline || recoveryKey.length === 0) return;
    await attemptUnlock('recovery-key', () =>
      unlockWithRecoveryKey(recoveryKey),
    );
  }

  async function handleCheckAgain(): Promise<void> {
    if (submitting || offline) return;
    clearFeedback();
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
        // Still nothing to unlock — stay here, and say so.
        setStillNoVault(true);
      } else if (failure === 'wrong-secret') {
        setMode(lastAttempt);
        setSecretError(describeUnlockFailure(failure, lastAttempt));
      } else {
        setMode(lastAttempt);
        setNotice(noticeFor(failure));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const backToPassphrase = useCallback(() => {
    setMode('passphrase');
    setSecretError(null);
    setNotice(null);
  }, []);
  useHardwareBack(mode === 'recovery-key', backToPassphrase);

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

  const email = user?.email ?? null;

  if (mode === 'no-vault') {
    return (
      <>
        <NoVaultView
          email={email}
          offline={offline}
          checking={submitting}
          still={stillNoVault}
          onCheckAgain={() => void handleCheckAgain()}
          onLogOut={() => setConfirmLogoutVisible(true)}
        />
        {confirmLogoutSheet}
      </>
    );
  }

  if (mode === 'recovery-key') {
    return (
      <RecoveryKeyView
        value={recoveryKey}
        onChange={(next) => {
          setRecoveryKey(next);
          setSecretError(null);
        }}
        error={secretError}
        notice={offline ? null : notice}
        offline={offline}
        submitting={submitting}
        onSubmit={() => void handleRecoveryKeySubmit()}
        onBack={backToPassphrase}
      />
    );
  }

  return (
    <>
      <PassphraseView
        email={email}
        lockedMessage={
          lockReason === 'auto-lock' ? <AutoLockReason /> : undefined
        }
        passphrase={passphrase}
        onPassphraseChange={(next) => {
          setPassphrase(next);
          setSecretError(null);
          setBioCancelled(false);
        }}
        secretError={secretError}
        notice={offline ? null : notice}
        offline={offline}
        submitting={submitting}
        biometricOn={biometric.state === 'on'}
        biometricCopy={biometricCopyFor(biometric.method)}
        biometricCancelled={bioCancelled}
        biometricNotice={bioNotice}
        onBiometric={() => void attemptBiometricUnlock(true)}
        onSubmit={() => void handlePassphraseSubmit()}
        onUseRecoveryKey={() => {
          clearFeedback();
          setBioCancelled(false);
          setMode('recovery-key');
        }}
        onLogOut={() => setConfirmLogoutVisible(true)}
      />
      {confirmLogoutSheet}
    </>
  );
}

/**
 * Why the User is here, when it was not their doing (Entry · Locked). A User
 * who pressed Lock is told nothing, because they already know.
 */
function AutoLockReason(): React.JSX.Element {
  const theme = useTheme();
  const autoLockDelay = useAutoLockDelay();
  return (
    <View
      accessible
      style={[
        styles.reason,
        // 4 above the email line; the glyph sits 6 from the text, which
        // rounds up to `sm`.
        { marginTop: theme.spacing.xs, gap: theme.spacing.sm },
      ]}
    >
      <Icon name="lock" size={16} color="brand" />
      <Text variant="bodySm">{describeAutoLock(autoLockDelay)}</Text>
    </View>
  );
}

function PassphraseView({
  email,
  lockedMessage,
  passphrase,
  onPassphraseChange,
  secretError,
  notice,
  offline,
  submitting,
  biometricOn,
  biometricCopy,
  biometricCancelled,
  biometricNotice,
  onBiometric,
  onSubmit,
  onUseRecoveryKey,
  onLogOut,
}: {
  email: string | null;
  lockedMessage: React.ReactNode;
  passphrase: string;
  onPassphraseChange: (next: string) => void;
  secretError: string | null;
  notice: UnlockNotice | null;
  offline: boolean;
  submitting: boolean;
  biometricOn: boolean;
  biometricCopy: BiometricMethodCopy;
  biometricCancelled: boolean;
  biometricNotice: string | null;
  onBiometric: () => void;
  onSubmit: () => void;
  onUseRecoveryKey: () => void;
  onLogOut: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen>
      <EntryScroll>
        {/* Log out sits in the top-right corner, pulled 12 into the gutter
            so its label lines up with the edge (Unlock sheets). */}
        <View
          style={[
            styles.trailing,
            { marginRight: -(theme.spacing.sm + theme.spacing.xs) },
          ]}
        >
          <Button
            label="Log out"
            variant="ghost"
            size="compact"
            onPress={onLogOut}
          />
        </View>

        {/* The hero rides 12 lower without the biometric button to balance
            the shorter controls below it: 12 with it (sm + xs), 28 without
            (lg + xs). */}
        <View
          style={[
            styles.hero,
            {
              paddingTop: biometricOn
                ? theme.spacing.sm + theme.spacing.xs
                : theme.spacing.lg + theme.spacing.xs,
              gap: theme.spacing.sm + theme.spacing.xs,
            },
          ]}
        >
          <BrandBadge size={104} markSize={64} />
          <Text
            variant="titleLg"
            accessibilityRole="header"
            style={[styles.centredText, { paddingTop: theme.spacing.sm }]}
          >
            Unlock your Vault
          </Text>
          {email !== null && <Text variant="caption">{email}</Text>}
          {lockedMessage}
        </View>

        <View style={styles.spacer} />

        <View
          style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xs }}
        >
          {offline ? (
            <InlineNotice tone="warning" message={UNLOCK_OFFLINE_MESSAGE} />
          ) : (
            notice !== null && (
              <InlineNotice
                tone="warning"
                iconColor={notice.mark === 'error' ? 'errorEdge' : undefined}
                message={notice.message}
              />
            )
          )}

          {biometricNotice !== null && (
            // The sheet's one boxed notice: a card that stands apart from the
            // controls, because it changes what the screen offers.
            <InlineNotice
              tone="warning"
              message={biometricNotice}
              // 12 × 14 in at radius 12: sm + xs, the nearer `md`, and `lg`.
              style={[
                styles.card,
                {
                  paddingVertical: theme.spacing.sm + theme.spacing.xs,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radii.lg,
                  borderColor: theme.colors.controlEdge,
                  backgroundColor: theme.colors.card,
                },
              ]}
            />
          )}

          {biometricOn && (
            <>
              <View style={{ gap: theme.spacing.sm }}>
                <Button
                  label={biometricCopy.unlockLabel}
                  icon={biometricCopy.icon}
                  variant="brand"
                  size="large"
                  disabled={offline || submitting}
                  onPress={onBiometric}
                />
                {biometricCancelled && (
                  <InlineNotice
                    tone="neutral"
                    message={biometricCopy.cancelled}
                  />
                )}
              </View>
              <OrDivider label="or use your passphrase" />
            </>
          )}

          <TextField
            label="Passphrase"
            value={passphrase}
            onChangeText={onPassphraseChange}
            error={secretError ?? undefined}
            secureTextEntry
            revealable
            revealLabel="passphrase"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="password"
            editable={!offline}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {/* Unlock is the violet action until Biometric Unlock is on, when
              the biometric button takes the colour and this steps down. */}
          <Button
            label="Unlock"
            variant={biometricOn ? 'secondary' : 'brand'}
            busy={submitting}
            disabled={offline}
            onPress={onSubmit}
          />

          {submitting && (
            <InlineNotice
              tone="neutral"
              variant="compact"
              icon="saving"
              iconColor="brand"
              message={DERIVING_LINE}
            />
          )}
        </View>

        <View style={styles.centredRow}>
          <Button
            label="Use Recovery Key instead"
            variant="link"
            size="compact"
            disabled={offline || submitting}
            onPress={onUseRecoveryKey}
          />
        </View>
      </EntryScroll>
    </Screen>
  );
}

function RecoveryKeyView({
  value,
  onChange,
  error,
  notice,
  offline,
  submitting,
  onSubmit,
  onBack,
}: {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  notice: UnlockNotice | null;
  offline: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const shown = offline
    ? ({ message: UNLOCK_OFFLINE_MESSAGE, mark: 'warning' } as const)
    : notice;

  return (
    <Screen>
      <EntryScroll>
        <BackLink label="Unlock" onPress={onBack} disabled={submitting} />

        <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          <Text variant="titleLg" accessibilityRole="header">
            Use your Recovery Key
          </Text>
          <Text variant="bodySm" color="mutedForeground">
            Enter the Recovery Key you saved when you set up your Vault.
          </Text>
        </View>

        {shown !== null && (
          <View style={{ paddingTop: theme.spacing.md }}>
            <InlineNotice
              tone="warning"
              iconColor={shown.mark === 'error' ? 'errorEdge' : undefined}
              message={shown.message}
            />
          </View>
        )}

        <View style={{ paddingTop: theme.spacing.lg + theme.spacing.xs }}>
          <TextField
            label="Recovery Key"
            // Shown in groups of four and stored without them: the web shows
            // and copies the key as one unbroken string, and a pasted key
            // decodes the same with or without its spaces.
            value={formatRecoveryKeyForDisplay(value)}
            onChangeText={(text) => onChange(stripRecoveryKeyWhitespace(text))}
            error={error ?? undefined}
            hint="44 characters in groups of four. Capitals matter; spaces don’t."
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            editable={!offline}
            returnKeyType="go"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={onSubmit}
            style={[
              styles.recoveryKey,
              {
                fontFamily: RECOVERY_KEY_FONT,
                letterSpacing: theme.type.body.fontSize * RECOVERY_KEY_TRACKING,
                // The sheet sets the key two rows of 28 (lg + xs), inset 4
                // more than the field's own padding.
                lineHeight: theme.spacing.lg + theme.spacing.xs,
                minHeight: (theme.spacing.lg + theme.spacing.xs) * 2,
                paddingVertical: theme.spacing.xs,
              },
            ]}
          />
        </View>

        <View style={{ paddingTop: theme.spacing.lg }}>
          <Button
            label="Unlock"
            variant="brand"
            busy={submitting}
            disabled={offline || value.length === 0}
            onPress={onSubmit}
          />
        </View>

        <View style={{ paddingTop: theme.spacing.md + theme.spacing.xs }}>
          <InlineNotice
            tone="neutral"
            message="To set a new passphrase, use the web app."
          />
        </View>
      </EntryScroll>
    </Screen>
  );
}

function NoVaultView({
  email,
  offline,
  checking,
  still,
  onCheckAgain,
  onLogOut,
}: {
  email: string | null;
  offline: boolean;
  checking: boolean;
  still: boolean;
  onCheckAgain: () => void;
  onLogOut: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const status = offline
    ? CHECK_AGAIN_OFFLINE_LINE
    : still
      ? STILL_NO_VAULT_LINE
      : null;

  return (
    <Screen>
      <EntryScroll>
        {/* Centred in what the actions leave, lifted 40 off them (xl + sm). */}
        <View
          style={[
            styles.centredBlock,
            {
              gap: theme.spacing.sm + theme.spacing.xs,
              paddingBottom: theme.spacing.xl + theme.spacing.sm,
            },
          ]}
        >
          <BrandBadge size={96} markSize={56} />
          <Text
            variant="titleLg"
            accessibilityRole="header"
            style={[
              styles.centredText,
              { paddingTop: theme.spacing.sm + theme.spacing.xs },
            ]}
          >
            No Vault yet
          </Text>
          <Text variant="body" style={[styles.centredText, styles.lead]}>
            Set up your Vault on the web, then come back.
          </Text>
          {email !== null && (
            <Text variant="caption" style={styles.centredText}>
              Signed in as {email}
            </Text>
          )}
        </View>

        {status !== null && (
          <View style={{ paddingBottom: theme.spacing.md }}>
            <InlineNotice
              tone={offline ? 'warning' : 'neutral'}
              message={status}
            />
          </View>
        )}

        <View
          style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
        >
          <Button
            label="Open the web app"
            icon="external"
            iconPosition="trailing"
            accessibilityRole="link"
            accessibilityHint="Opens the web app in your browser"
            onPress={() => void Linking.openURL(WEB_APP_URL)}
          />
          <Button
            label="Check again"
            variant="secondary"
            busy={checking}
            disabled={offline}
            onPress={onCheckAgain}
          />
          <Button
            label="Log out"
            variant="ghost"
            disabled={checking}
            onPress={onLogOut}
          />
        </View>
      </EntryScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  trailing: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  hero: {
    alignItems: 'center',
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    flexGrow: 1,
  },
  centredRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  centredBlock: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centredText: {
    textAlign: 'center',
  },
  // The sheet's measure for the one line, which keeps it to two lines on any
  // width. A layout width, not spacing — no token applies.
  lead: {
    maxWidth: 320,
  },
  card: {
    borderWidth: 1,
  },
  recoveryKey: {
    textAlignVertical: 'top',
  },
});
