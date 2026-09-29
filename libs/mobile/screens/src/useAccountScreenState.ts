import { useCallback, useState } from 'react';
import {
  setAppearance,
  setAutoLockDelay,
  setKeepScreenAwake,
  useAppearance,
  useAutoLockDelay,
  useKeepScreenAwakeSetting,
  type Appearance,
  type AutoLockDelay,
} from '@myorganizer/mobile/core';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  performBiometricDisable,
  performBiometricEnable,
  shouldDisableBiometricOnLogout,
} from './accountScreenLogic';

/**
 * The one sheet the Account tab can have up. One value rather than a flag per
 * sheet, so two can never be open at once.
 */
export type AccountSheet =
  | 'biometricEnable'
  | 'biometricDisable'
  | 'autoLock'
  | 'logout'
  | null;

interface AccountScreenState {
  sheet: AccountSheet;
  openSheet: (sheet: Exclude<AccountSheet, null>) => void;
  closeSheet: () => void;
  biometricBusy: boolean;
  biometricError: string | null;
  setBiometricError: (value: string | null) => void;
  appearance: Appearance;
  autoLockDelay: AutoLockDelay;
  keepScreenAwake: boolean;
  /**
   * The Biometric Unlock switch was flipped. Neither direction acts at once:
   * on asks for the passphrase, off asks to confirm.
   */
  handleBiometricToggle: (next: boolean) => void;
  handleBiometricEnable: (passphrase: string) => Promise<void>;
  handleBiometricDisable: () => Promise<void>;
  handleAppearanceChange: (appearance: Appearance) => void;
  handleAutoLockChange: (delay: AutoLockDelay) => void;
  handleKeepScreenAwakeChange: (value: boolean) => void;
  handleLogout: () => Promise<void>;
}

/**
 * The Account tab's state. The three Device Settings are read through their
 * store subscriptions, so the tab shows a change made anywhere — the Grocery
 * List menu's "Keep screen on", say — the moment it is written, rather than
 * when the tab next mounts.
 */
export function useAccountScreenState(): AccountScreenState {
  const { logout } = useAuth();
  const { biometric } = useVaultSession();
  const appearance = useAppearance();
  const autoLockDelay = useAutoLockDelay();
  const keepScreenAwake = useKeepScreenAwakeSetting();
  const [sheet, setSheet] = useState<AccountSheet>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const openSheet = useCallback((next: Exclude<AccountSheet, null>): void => {
    setBiometricError(null);
    setSheet(next);
  }, []);

  const closeSheet = useCallback((): void => {
    setBiometricError(null);
    setSheet(null);
  }, []);

  const handleBiometricToggle = useCallback(
    (next: boolean): void => {
      if (next && biometric.state === 'off') openSheet('biometricEnable');
      else if (!next && biometric.state === 'on') openSheet('biometricDisable');
    },
    [biometric.state, openSheet],
  );

  const handleBiometricEnable = useCallback(
    async (passphrase: string): Promise<void> => {
      setBiometricBusy(true);
      setBiometricError(null);
      try {
        const result = await performBiometricEnable(biometric, passphrase);
        if (result.success && result.shouldCloseSheet) {
          setSheet(null);
        } else {
          setBiometricError(result.errorMessage);
        }
      } finally {
        setBiometricBusy(false);
      }
    },
    [biometric],
  );

  const handleBiometricDisable = useCallback(async (): Promise<void> => {
    setBiometricBusy(true);
    try {
      await performBiometricDisable(biometric);
      setSheet(null);
    } finally {
      setBiometricBusy(false);
    }
  }, [biometric]);

  const handleAppearanceChange = useCallback((next: Appearance): void => {
    setAppearance(next);
  }, []);

  const handleAutoLockChange = useCallback((delay: AutoLockDelay): void => {
    setAutoLockDelay(delay);
  }, []);

  const handleKeepScreenAwakeChange = useCallback((value: boolean): void => {
    setKeepScreenAwake(value);
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    setSheet(null);
    if (shouldDisableBiometricOnLogout(biometric.state)) {
      await biometric.disable();
    }
    await logout();
  }, [biometric, logout]);

  return {
    sheet,
    openSheet,
    closeSheet,
    biometricBusy,
    biometricError,
    setBiometricError,
    appearance,
    autoLockDelay,
    keepScreenAwake,
    handleBiometricToggle,
    handleBiometricEnable,
    handleBiometricDisable,
    handleAppearanceChange,
    handleAutoLockChange,
    handleKeepScreenAwakeChange,
    handleLogout,
  };
}
