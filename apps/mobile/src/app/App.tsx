import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, apiClient } from '@myorganizer/mobile/feat-auth';
import { VaultProvider, createVaultApi } from '@myorganizer/mobile/feat-vault';
import { useAppearance } from '@myorganizer/mobile/core';
import { ThemeProvider } from '@myorganizer/mobile/ui';
import { RootNavigator } from '@myorganizer/mobile/screens';

/**
 * Reads the appearance Device Setting and hands it to the theme. Split out so
 * that an appearance change re-renders only the theme boundary, not the
 * providers above it.
 */
function ThemedApp(): React.JSX.Element {
  const appearance = useAppearance();

  return (
    <ThemeProvider appearance={appearance}>
      <RootNavigator />
    </ThemeProvider>
  );
}

export default function App(): React.JSX.Element {
  // The vault client shares the auth Axios instance, so its requests carry the
  // bearer token and ride the 401 → refresh interceptor.
  const vaultApi = useMemo(() => createVaultApi(apiClient), []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <VaultProvider vaultApi={vaultApi}>
          <ThemedApp />
        </VaultProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
