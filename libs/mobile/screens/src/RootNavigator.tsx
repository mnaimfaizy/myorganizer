import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenContainer, ThemedText, ThemedButton } from '@myorganizer/mobile/ui';

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
    <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText variant="heading">MyOrganizer</ThemedText>
      <ThemedText variant="body" style={{ marginTop: 8 }}>
        Mobile foundation ready.
      </ThemedText>
      <ThemedButton
        label="Get Started"
        variant="primary"
        style={{ marginTop: 24, alignSelf: 'stretch' }}
        onPress={() => undefined}
      />
    </ScreenContainer>
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
