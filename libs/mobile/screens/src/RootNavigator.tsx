import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '@myorganizer/mobile/ui';

export type RootStackParamList = {
  Placeholder: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Placeholder landing screen for the foundation slice. Feature slices replace
 * this stack with the Login → Unlock → Tasks flow.
 */
function PlaceholderScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MyOrganizer</Text>
      <Text style={styles.subtitle}>Mobile foundation ready.</Text>
    </View>
  );
}

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack">
        <Stack.Screen
          name="Placeholder"
          component={PlaceholderScreen}
          options={{ title: 'MyOrganizer' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: theme.colors.muted,
  },
});
