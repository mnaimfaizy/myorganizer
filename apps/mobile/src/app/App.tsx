import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, apiClient } from '@myorganizer/mobile/feat-auth';
import { VaultProvider, createVaultApi } from '@myorganizer/mobile/feat-vault';
import { RootNavigator } from '@myorganizer/mobile/screens';

export default function App(): React.JSX.Element {
  // The vault client shares the auth Axios instance, so its requests carry the
  // bearer token and ride the 401 → refresh interceptor.
  const vaultApi = useMemo(() => createVaultApi(apiClient), []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <VaultProvider vaultApi={vaultApi}>
          <RootNavigator />
        </VaultProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
