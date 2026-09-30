import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AuthProvider,
  apiClient,
  useAuth,
} from '@myorganizer/mobile/feat-auth';
import {
  SensitiveCopyProvider,
  VaultProvider,
  createVaultApi,
  disableBiometricUnlock,
  nativeBiometricKeystore,
} from '@myorganizer/mobile/feat-vault';
import { forgetResumePoint, useAppearance } from '@myorganizer/mobile/core';
import { ThemeProvider } from '@myorganizer/mobile/ui';
import { AppLockGate, RootNavigator } from '@myorganizer/mobile/screens';

/**
 * Reads the appearance Device Setting and hands it to the theme. Split out so
 * that an appearance change re-renders only the theme boundary, not the
 * providers above it.
 */
function ThemedApp(): React.JSX.Element {
  const appearance = useAppearance();

  return (
    <ThemeProvider appearance={appearance}>
      <AppLockGate>
        <RootNavigator />
      </AppLockGate>
    </ThemeProvider>
  );
}

/**
 * Binds the Vault session to the signed-in User.
 *
 * A component of its own because it has to sit *between* the two providers:
 * the User id it passes down is what makes Biometric Unlock belong to one User
 * (ADR 0108 decision 3), and it can only be read below `AuthProvider`.
 */
function UserVaultBoundary({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user } = useAuth();
  // The vault client shares the auth Axios instance, so its requests carry the
  // bearer token and ride the 401 → refresh interceptor.
  const vaultApi = useMemo(() => createVaultApi(apiClient), []);

  return (
    <VaultProvider vaultApi={vaultApi} userId={user?.id ?? null}>
      <SensitiveCopyProvider>{children}</SensitiveCopyProvider>
    </VaultProvider>
  );
}

export default function App(): React.JSX.Element {
  /**
   * What Logout takes with it. Both of these belong to the User who is leaving
   * and to this device: the keystore item holding their Master Key (ADR 0108
   * decision 3), and the scroll positions of the screens they were reading.
   *
   * It is wired here rather than inside either library because this is the
   * only place that can see both.
   */
  const handleLogout = useCallback(async (userId: string): Promise<void> => {
    forgetResumePoint();
    await disableBiometricUnlock(nativeBiometricKeystore, userId);
  }, []);

  return (
    // The gesture root has to be above everything that uses a gesture, and it
    // has to fill the window: a swipeable row inside a tree that is not under
    // one receives no touches at all on Android.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider onLogout={handleLogout}>
          <UserVaultBoundary>
            <ThemedApp />
          </UserVaultBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
