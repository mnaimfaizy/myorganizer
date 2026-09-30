import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
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

const SensitiveCopyContext = createContext<UseSensitiveCopyResult | null>(null);

interface SensitiveCopyProviderProps {
  /** The Sensitive Clipboard. Defaulted to the real one; injectable for tests. */
  clipboard?: SensitiveClipboard;
  children: ReactNode;
}

/**
 * The one owner of a sensitive copy, and the one place that clears it — on a
 * Vault lock on both platforms, and on Android also on a return to the
 * foreground, since Android promises no timed clear of its own.
 *
 * It sits once at the app root, inside `VaultProvider`, rather than in each
 * screen with a copy button. A clear that lived in the screen went with the
 * screen: copy an Address, go back to the list, lock the Vault, and nothing
 * was left mounted to clear it — "cleared on Vault lock everywhere" (#908)
 * held only while the User stayed where they copied.
 *
 * It tracks only the value *it* last copied, so a clear here is a copy this
 * app made and never a value the User copied from somewhere else — the
 * clipboard is re-read before it is cleared.
 */
export function SensitiveCopyProvider({
  clipboard = nativeSensitiveClipboard,
  children,
}: SensitiveCopyProviderProps): React.JSX.Element {
  const { status } = useVaultSession();
  const appState = useAppState();
  const lastCopiedRef = useRef<string | null>(null);

  const clearLastCopy = useCallback((): void => {
    const value = lastCopiedRef.current;
    if (value == null) return;
    lastCopiedRef.current = null;
    void clipboard.clearIfOwned(value);
  }, [clipboard]);

  useEffect(() => {
    if (status === 'locked') clearLastCopy();
  }, [status, clearLastCopy]);

  // Android only: iOS's own expiring pasteboard item already drops the copy
  // on its own schedule, so nothing here has to. Android promises no timed
  // clear, so a return to the foreground is the other trigger the Details
  // slice spec names, best-effort like the lock-triggered clear above — the
  // ref is read and cleared together so a leading `active` this provider was
  // already mounted for is not mistaken for a return from the background.
  const previousAppStateRef = useRef(appState);
  useEffect(() => {
    const previous = previousAppStateRef.current;
    previousAppStateRef.current = appState;
    if (Platform.OS !== 'android') return;
    if (previous === 'active' || appState !== 'active') return;
    clearLastCopy();
  }, [appState, clearLastCopy]);

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

  const value = useMemo(() => ({ copy }), [copy]);

  return (
    <SensitiveCopyContext.Provider value={value}>
      {children}
    </SensitiveCopyContext.Provider>
  );
}

/** The Details slice's tap-to-copy action. See `SensitiveCopyProvider`. */
export function useSensitiveCopy(): UseSensitiveCopyResult {
  const context = useContext(SensitiveCopyContext);
  if (!context) {
    throw new Error(
      'useSensitiveCopy must be used within a SensitiveCopyProvider',
    );
  }
  return context;
}
