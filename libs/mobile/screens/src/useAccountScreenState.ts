import { useCallback, useMemo, useState } from 'react';
import {
  getDeviceSettings,
  setAppearance,
  setAutoLockDelay,
  setKeepScreenAwake,
} from '@myorganizer/mobile/core';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  computeBiometricLabel,
  findSettingLabel,
  performBiometricEnable,
  performBiometricDisable,
  shouldDisableBiometricOnLogout,
} from './accountScreenLogic';

interface AccountScreenState {
  refreshKey: number;
  showBiometricDisableConfirm: boolean;
  showBiometricEnable: boolean;
  biometricBusy: boolean;
  biometricError: string | null;
  showAppearanceMenu: boolean;
  showAutoLockMenu: boolean;
  showLogoutConfirm: boolean;
  biometricLabel: string;
  biometricEnabled: boolean;
  biometricDisabled: boolean;
  appearanceLabel: string;
  autoLockLabel: string;
  keepScreenAwake: boolean;
  handleBiometricEnable: () => Promise<void>;
  handleBiometricDisable: () => Promise<void>;
  handleAppearanceChange: (appearance: 'system' | 'light' | 'dark') => void;
  handleAutoLockChange: (delay: 'immediately' | '1m' | '5m' | '15m') => void;
  handleKeepScreenAwakeChange: (value: boolean) => void;
  handleLogout: () => Promise<void>;
  setShowBiometricDisableConfirm: (value: boolean) => void;
  setShowBiometricEnable: (value: boolean) => void;
  setBiometricError: (value: string | null) => void;
  setShowAppearanceMenu: (value: boolean) => void;
  setShowAutoLockMenu: (value: boolean) => void;
  setShowLogoutConfirm: (value: boolean) => void;
}

const autoLockDelayOptions = [
  { id: 'immediately', label: 'Immediately', value: 'immediately' as const },
  { id: '1m', label: '1 minute', value: '1m' as const },
  { id: '5m', label: '5 minutes', value: '5m' as const },
  { id: '15m', label: '15 minutes', value: '15m' as const },
];

const appearanceOptions = [
  { id: 'system', label: 'System', value: 'system' as const },
  { id: 'light', label: 'Light', value: 'light' as const },
  { id: 'dark', label: 'Dark', value: 'dark' as const },
];

export function useAccountScreenState(): AccountScreenState {
  const { logout } = useAuth();
  const { biometric } = useVaultSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBiometricDisableConfirm, setShowBiometricDisableConfirm] =
    useState(false);
  const [showBiometricEnable, setShowBiometricEnable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);
  const [showAutoLockMenu, setShowAutoLockMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const settings = useMemo(() => getDeviceSettings(), [refreshKey]);

  const handleBiometricEnable = useCallback(async (): Promise<void> => {
    setBiometricBusy(true);
    setBiometricError(null);
    try {
      const result = await performBiometricEnable(biometric);
      if (result.success && result.shouldCloseSheet) {
        setShowBiometricEnable(false);
        setRefreshKey((prev) => prev + 1);
      } else {
        setBiometricError(result.errorMessage);
      }
    } finally {
      setBiometricBusy(false);
    }
  }, [biometric]);

  const handleBiometricDisable = useCallback(async (): Promise<void> => {
    setBiometricBusy(true);
    try {
      await performBiometricDisable(biometric);
      setShowBiometricDisableConfirm(false);
      setRefreshKey((prev) => prev + 1);
    } finally {
      setBiometricBusy(false);
    }
  }, [biometric]);

  const handleAppearanceChange = useCallback(
    (appearance: 'system' | 'light' | 'dark'): void => {
      setAppearance(appearance);
      setShowAppearanceMenu(false);
      setRefreshKey((prev) => prev + 1);
    },
    [],
  );

  const handleAutoLockChange = useCallback(
    (delay: 'immediately' | '1m' | '5m' | '15m'): void => {
      setAutoLockDelay(delay);
      setShowAutoLockMenu(false);
      setRefreshKey((prev) => prev + 1);
    },
    [],
  );

  const handleKeepScreenAwakeChange = useCallback((value: boolean): void => {
    setKeepScreenAwake(value);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    setShowLogoutConfirm(false);
    if (shouldDisableBiometricOnLogout(biometric.state)) {
      await biometric.disable();
    }
    await logout();
  }, [biometric, logout]);

  const biometricLabelResult = useMemo(
    () => computeBiometricLabel(biometric.state),
    [biometric.state],
  );

  const appearanceLabel = useMemo(
    () => findSettingLabel(settings.appearance, appearanceOptions, 'System'),
    [settings.appearance],
  );

  const autoLockLabel = useMemo(
    () =>
      findSettingLabel(
        settings.autoLockDelay,
        autoLockDelayOptions,
        '5 minutes',
      ),
    [settings.autoLockDelay],
  );

  return {
    refreshKey,
    showBiometricDisableConfirm,
    showBiometricEnable,
    biometricBusy,
    biometricError,
    showAppearanceMenu,
    showAutoLockMenu,
    showLogoutConfirm,
    biometricLabel: biometricLabelResult.label,
    biometricEnabled: biometricLabelResult.enabled,
    biometricDisabled: biometricLabelResult.disabled,
    appearanceLabel,
    autoLockLabel,
    keepScreenAwake: settings.keepScreenAwake,
    handleBiometricEnable,
    handleBiometricDisable,
    handleAppearanceChange,
    handleAutoLockChange,
    handleKeepScreenAwakeChange,
    handleLogout,
    setShowBiometricDisableConfirm,
    setShowBiometricEnable,
    setBiometricError,
    setShowAppearanceMenu,
    setShowAutoLockMenu,
    setShowLogoutConfirm,
  };
}
