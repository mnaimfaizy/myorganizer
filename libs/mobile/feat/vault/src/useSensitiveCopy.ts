import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAppState } from '@myorganizer/mobile/ui';
import { useVaultSession } from './context/VaultSessionContext';
import { nativeSensitiveClipboard } from './clipboard/nativeSensitiveClipboard';
import {
  copyConfirmationMessage,
  sensitiveCopyOutcomeFor,
  type SensitiveClipboard,
} from './clipboard/sensitiveClipboard';

export interface UseSensitiveCopyResult {
  /**
   * Copies `value` the way this platform's clipboard privacy model asks for,
   * and returns what to tell the User — the exact confirmation copy, or
   * `null` when the platform's own clipboard preview already confirms it and
   * a toast on top would say the same thing twice.
   */
  copy: (value: string) => Promise<string | null>;
}

/**
 * The Details slice's tap-to-copy action, and the one place that clears a
 * copy — on a Vault lock on both platforms, and on Android also on a return
 * to the foreground, since Android promises no timed clear of its own.
 *
 * A device may hold several of these — one per screen with a copy button —
 * and each tracks only the value *it* last copied, so a clear here is a copy
 * this hook made and never a value the User copied from somewhere else
 * ([ADR 0108](../../../../../docs/adr/0108-a-mobile-device-may-hold-the-master-key-behind-a-biometric-gate.md)'s
 * "the session behind it is untouched" holds for the clipboard the same way
 * it holds for the Vault itself).
 */
export function useSensitiveCopy(
  clipboard: SensitiveClipboard = nativeSensitiveClipboard,
): UseSensitiveCopyResult {
  const { status } = useVaultSession();
  const appState = useAppState();
  const lastCopiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'locked') return;
    const value = lastCopiedRef.current;
    if (value == null) return;
    lastCopiedRef.current = null;
    void clipboard.clearIfOwned(value);
  }, [status, clipboard]);

  // Android only: iOS's own expiring pasteboard item already drops the copy
  // on its own schedule, so nothing here has to. Android promises no timed
  // clear, so a return to the foreground is the other trigger the Details
  // slice spec names, best-effort like the lock-triggered clear above — the
  // ref is read and cleared together so a leading `active` this hook was
  // already mounted for is not mistaken for a return from the background.
  const previousAppStateRef = useRef(appState);
  useEffect(() => {
    const previous = previousAppStateRef.current;
    previousAppStateRef.current = appState;
    if (Platform.OS !== 'android') return;
    if (previous === 'active' || appState !== 'active') return;
    const value = lastCopiedRef.current;
    if (value == null) return;
    lastCopiedRef.current = null;
    void clipboard.clearIfOwned(value);
  }, [appState, clipboard]);

  const copy = useCallback(
    async (value: string): Promise<string | null> => {
      const outcome = sensitiveCopyOutcomeFor(
        Platform.OS === 'ios'
          ? { os: 'ios' }
          : { os: 'android', androidApiLevel: Number(Platform.Version) },
      );
      await clipboard.copy(value, outcome);
      lastCopiedRef.current = value;
      return copyConfirmationMessage(outcome);
    },
    [clipboard],
  );

  return { copy };
}
