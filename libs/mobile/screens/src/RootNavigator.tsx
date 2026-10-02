import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  MOTION,
  Screen,
  useReduceMotion,
  useTheme,
} from '@myorganizer/mobile/ui';
import { navigationTheme } from './navigationTheme';
import { BiometricOfferSheet } from './BiometricOfferSheet';
import { LoginScreen } from './LoginScreen';
import { UnlockScreen } from './UnlockScreen';
import { MainTabs } from './MainTabs';

export type RootStackParamList = {
  Login: undefined;
  Unlock: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * How long Unlock takes to rise over the privacy cover after a lock (Entry ·
 * Locked, step 3). Its own beat rather than one of the Motion sheet's: it is
 * the one full-screen transition the Entry page draws.
 */
const UNLOCK_RISE_MS = 240;

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
    <Screen noPadding style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} />
    </Screen>
  );
}

/**
 * Root navigation. The visible stack is driven by the auth session: while the
 * session restores we show a spinner, an unauthenticated User sees Login, a
 * locked Vault sees Unlock, and an unlocked one lands in the tab shell.
 * Switching `status` swaps the stack, so login and logout navigate
 * implicitly.
 *
 * The colour mode reaches two places outside this app's own components — the
 * navigator, through `NavigationContainer`'s theme, and the OS status bar.
 * Both default to light and neither is covered by `Screen`, so a dark
 * app without them has a light seam behind its transitions and unreadable
 * status-bar glyphs. The status bar sits outside the auth branch because the
 * spinner is a full screen too.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();
  const { status: vaultStatus } = useVaultSession();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  // `Platform.OS` is read here rather than inside `navigationTheme`, which
  // stays pure: the two platforms disagree about what a font weight means, and
  // that is a fact about the device, not about the theme.
  const navTheme = useMemo(
    () => navigationTheme(theme, Platform.OS === 'ios' ? 'ios' : 'android'),
    [theme],
  );

  return (
    <>
      {/* Glyph style only. Android enforces edge-to-edge at targetSdk 36,
          so the system draws the bar transparent and a background colour here
          would be dead configuration; the inset is the screen root's job. */}
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
      />
      {status === 'loading' ? (
        <LoadingScreen />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            id="RootStack"
            screenOptions={{ headerShown: false }}
          >
            {status !== 'authenticated' ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : vaultStatus === 'locked' ? (
              <Stack.Screen
                name="Unlock"
                component={UnlockScreen}
                // Unlock rises over the cover when the Vault locks under the
                // User, so the tab they were on is never drawn again; under
                // Reduce Motion it cross-fades instead (Entry · Locked). The
                // native stack takes a duration but not a curve — it runs
                // the platform's own deceleration, which is the ease-out
                // drawn — and honours the duration on iOS only.
                options={{
                  animation: reduceMotion ? 'fade' : 'slide_from_bottom',
                  animationDuration: reduceMotion
                    ? MOTION.reducedFade
                    : UNLOCK_RISE_MS,
                }}
              />
            ) : (
              <Stack.Screen name="Main" component={MainTabs} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      )}
      {/* Outside the navigator, because the offer is about the session rather
          than about any screen: it is raised over whichever tab the unlock
          landed on, and it decides for itself whether there is anything to
          offer. */}
      <BiometricOfferSheet />
    </>
  );
}
