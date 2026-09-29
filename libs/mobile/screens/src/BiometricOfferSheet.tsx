import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  hasOfferedBiometricUnlock,
  markBiometricUnlockOffered,
} from '@myorganizer/mobile/core';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  mayEnableBiometricUnlock,
  useVaultSession,
} from '@myorganizer/mobile/feat-vault';
import {
  BottomSheet,
  Button,
  InlineNotice,
  Text,
  useTheme,
} from '@myorganizer/mobile/ui';
import { describeEnrolmentFailure } from './biometricUnlockMessages';

/**
 * The one offer to turn Biometric Unlock on (ADR 0108 decision 1), made after
 * a passphrase unlock and never again — every later chance is the switch in
 * Account.
 *
 * Four things have to hold for it to appear, and each one is a rule rather
 * than a guard:
 *
 * - `mayEnableBiometricUnlock` says this authority may enrol — a passphrase
 *   unlock, recent enough to stand for the User being here. Offering what the
 *   policy would then refuse is offering nothing;
 * - the device has a strong biometric and this User has not already stored a
 *   key here;
 * - this installation has not offered this User before. Declining is an
 *   answer, and an offer that comes back on the next unlock is a nag;
 * - there is a signed-in User to bind the key to.
 */
export function BiometricOfferSheet(): React.JSX.Element | null {
  const theme = useTheme();
  const { user } = useAuth();
  const { status, unlockSecret, unlockedAt, biometric } = useVaultSession();

  // Which User answered, rather than whether anyone did. This component is
  // mounted by the navigation root and so outlives a logout: a plain boolean
  // would let the User who dismissed it also decline it on behalf of the next
  // User to sign in on this device.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const offerable =
    status === 'unlocked' &&
    unlockSecret !== null &&
    // The enrolment rule itself, asked rather than restated. Offering what the
    // policy would then refuse is how the two drift apart, and this is also
    // what keeps the sheet from lingering past the passphrase's freshness.
    mayEnableBiometricUnlock({
      secret: unlockSecret,
      unlockedAt,
      now: Date.now(),
    }) &&
    biometric.state === 'off' &&
    userId !== null &&
    dismissedFor !== userId &&
    !hasOfferedBiometricUnlock(userId);

  if (!offerable) return null;

  /**
   * Ends the offer.
   *
   * `spent` is whether this counts as the one offer. Accepting and declining
   * both do — a decline is an answer. A keystore that refused the write does
   * not: the User never got to answer, and spending the offer on the device's
   * refusal would take the feature away from them until the Account switch
   * exists to give it back.
   */
  function close(spent: boolean): void {
    if (userId === null) return;
    // Written down as well as held in state: the state ends with this run of
    // the app, and "offered once" has to outlast a relaunch.
    if (spent) markBiometricUnlockOffered(userId);
    setDismissedFor(userId);
  }

  async function handleTurnOn(): Promise<void> {
    setBusy(true);
    setError(null);
    const enrolment = await biometric.enable();
    setBusy(false);

    if (enrolment.outcome === 'enabled') {
      close(true);
      return;
    }
    // A refusal or a keystore failure leaves the sheet up with the reason:
    // silently closing would tell the User it worked, and the four reasons ask
    // for four different things of them.
    setError(describeEnrolmentFailure(enrolment));
  }

  return (
    <BottomSheet
      visible
      // Dismissing after a failed write is not an answer, so it does not spend
      // the offer; dismissing the question itself is, and does.
      onDismiss={() => close(error === null)}
      title="Turn on Biometric Unlock?"
    >
      <Text variant="body" color="mutedForeground">
        Unlock your vault with a glance instead of typing your passphrase. Your
        passphrase and recovery key keep working, the key never leaves this
        device, and logging out removes it.
      </Text>

      {error != null && <InlineNotice tone="destructive" message={error} />}

      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <Button
          label="Turn on"
          icon="biometric"
          busy={busy}
          onPress={() => void handleTurnOn()}
        />
        <Button
          label="Not now"
          variant="ghost"
          disabled={busy}
          onPress={() => close(error === null)}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'column',
  },
});
