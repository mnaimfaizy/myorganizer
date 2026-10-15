import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AuthProvider,
  apiClient,
  reportRefusedWrite,
  useAuth,
  versionFloorRefusal,
} from '@myorganiser/mobile/feat-auth';
import {
  SensitiveCopyProvider,
  VaultProvider,
  createVaultApi,
} from '@myorganiser/mobile/feat-vault';
import {
  rememberLocalDataOwner,
  useAppearance,
} from '@myorganiser/mobile/core';
import { ThemeProvider } from '@myorganiser/mobile/ui';
import {
  AppLockGate,
  RootNavigator,
  VersionFloorGate,
} from '@myorganiser/mobile/screens';
import { BackendOriginGate } from './BackendOriginGate';
import { clearUserLocalData } from './userLocalData';

/**
 * Reads the appearance Device Setting and hands it to the theme. Split out so
 * that an appearance change re-renders only the theme boundary, not the
 * providers above it.
 */
function ThemedApp(): React.JSX.Element {
  const appearance = useAppearance();

  return (
    <ThemeProvider appearance={appearance}>
      <VersionFloorGate>
        <AppLockGate>
          <RootNavigator />
        </AppLockGate>
      </VersionFloorGate>
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
  const userId = user?.id ?? null;
  // A signed-in User holds local data under this backend origin; the data
  // guard clears theirs if the origin later changes.
  useEffect(() => {
    if (userId) rememberLocalDataOwner(userId);
  }, [userId]);
  // The vault client shares the auth Axios instance, so its requests carry the
  // bearer token and ride the 401 → refresh interceptor.
  const vaultApi = useMemo(() => createVaultApi(apiClient), []);

  return (
    <VaultProvider
      vaultApi={vaultApi}
      userId={userId}
      onWriteFailed={reportRefusedVaultPush}
    >
      <SensitiveCopyProvider>{children}</SensitiveCopyProvider>
    </VaultProvider>
  );
}

/** Tells Update required when a refused Vault Push lost the last change. */
function reportRefusedVaultPush(error: unknown): void {
  reportRefusedWrite(versionFloorRefusal, error);
}

export default function App(): React.JSX.Element {
  /**
   * What Logout takes with it: the leaving User's local data on this device
   * (see userLocalData.ts). Device Settings stay.
   */
  const handleLogout = useCallback(async (userId: string): Promise<void> => {
    await clearUserLocalData([userId]);
  }, []);

  return (
    // The gesture root has to be above everything that uses a gesture, and it
    // has to fill the window: a swipeable row inside a tree that is not under
    // one receives no touches at all on Android.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BackendOriginGate>
          {(guard) => (
            <AuthProvider
              onLogout={handleLogout}
              restoreOnLaunch={guard === 'ready'}
            >
              <UserVaultBoundary>
                <ThemedApp />
              </UserVaultBoundary>
            </AuthProvider>
          )}
        </BackendOriginGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
