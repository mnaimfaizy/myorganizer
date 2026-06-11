import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  useTheme,
} from '@myorganizer/mobile/ui';

/**
 * Authenticated landing screen. Shows who is signed in and a logout affordance
 * that clears the session and routes the User back to Login (handled by the
 * root navigator reacting to `status`).
 */
export function HomeScreen(): React.JSX.Element {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const greeting = user?.firstName ? `Welcome, ${user.firstName}` : 'Welcome';

  return (
    <ScreenContainer>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <ThemedText variant="heading">{greeting}</ThemedText>
        {user?.email != null && (
          <ThemedText variant="caption">{user.email}</ThemedText>
        )}
        <ThemedButton
          label={loggingOut ? 'Logging out…' : 'Log out'}
          variant="outline"
          onPress={() => void handleLogout()}
          disabled={loggingOut}
          style={{ marginTop: theme.spacing.lg }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
