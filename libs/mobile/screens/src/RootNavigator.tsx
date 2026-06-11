import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { theme } from '@myorganizer/mobile/ui';
import { LoginScreen } from './LoginScreen';
import { HomeScreen } from './HomeScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Full-screen spinner shown while the auth session is being restored. */
function LoadingScreen(): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
      }}
    >
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

/**
 * Root navigation. The visible stack is driven by the auth session: while the
 * session restores we show a spinner, an unauthenticated User sees Login, and
 * an authenticated User lands on Home. Switching `status` swaps the stack, so
 * login and logout navigate implicitly.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
        {status === 'authenticated' ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
