import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import { ScreenContainer, useTheme } from '@myorganizer/mobile/ui';
import { LoginScreen } from './LoginScreen';
import { UnlockScreen } from './UnlockScreen';
import { MainTabs } from './MainTabs';

export type RootStackParamList = {
  Login: undefined;
  Unlock: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Full-screen spinner shown while the auth session is being restored. */
function LoadingScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <ScreenContainer noPadding style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} />
    </ScreenContainer>
  );
}

/**
 * Root navigation. The visible stack is driven by the auth session: while the
 * session restores we show a spinner, an unauthenticated User sees Login, a
 * locked Vault sees Unlock, and an unlocked one lands in the tab shell.
 * Switching `status` swaps the stack, so login and logout navigate
 * implicitly.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();
  const { status: vaultStatus } = useVaultSession();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
        {status !== 'authenticated' ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : vaultStatus === 'locked' ? (
          <Stack.Screen name="Unlock" component={UnlockScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
