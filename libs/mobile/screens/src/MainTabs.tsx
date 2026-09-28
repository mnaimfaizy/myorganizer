import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getDeviceSettings, setLastTab } from '@myorganizer/mobile/core';
import { useTheme } from '@myorganizer/mobile/ui';
import { AccountScreen } from './AccountScreen';
import { DetailsScreen } from './DetailsScreen';
import { GroceriesScreen } from './GroceriesScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';
import { TasksScreen } from './TasksScreen';
import {
  DEFAULT_TAB,
  isTabName,
  TAB_NAMES,
  type MainTabParamList,
  type TabName,
} from './tabs';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Wraps a tab's screen in its own native stack, so each tab keeps a
 * navigation history of its own: pushing inside Groceries and switching to
 * Tasks leaves Groceries where it was.
 *
 * Built once per tab at module scope rather than inside a render, because a
 * navigator created during render is a new component type on every render and
 * remounts the whole tab.
 */
function tabStack(
  name: TabName,
  Screen: React.ComponentType,
): React.ComponentType {
  const Stack = createNativeStackNavigator<Record<string, undefined>>();

  function TabStack(): React.JSX.Element {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={`${name}Home`} component={Screen} />
      </Stack.Navigator>
    );
  }
  TabStack.displayName = `${name}TabStack`;
  return TabStack;
}

/** One stack per tab, pinned to the tab list so neither side can drift. */
const TAB_STACKS = {
  Groceries: tabStack('Groceries', GroceriesScreen),
  Tasks: tabStack('Tasks', TasksScreen),
  Subscriptions: tabStack('Subscriptions', SubscriptionsScreen),
  Details: tabStack('Details', DetailsScreen),
  Account: tabStack('Account', AccountScreen),
} as const satisfies Record<TabName, React.ComponentType>;

/**
 * The signed-in, unlocked app: five tabs, each owning a stack.
 *
 * The tab bar carries labels and no icons. The approved design sheet owns the
 * iconography and this slice does not have it, and a guessed glyph set is
 * harder to remove later than an absent one is to add.
 */
export function MainTabs(): React.JSX.Element {
  const theme = useTheme();

  // Read once, imperatively: `initialRouteName` is only consulted when the
  // navigator first builds its state, and subscribing here would re-render
  // this component on every tab change for a prop nothing reads again.
  const [initialTab] = useState<TabName>(() => {
    const { lastTab } = getDeviceSettings();
    return isTabName(lastTab) ? lastTab : DEFAULT_TAB;
  });

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenListeners={({ route }) => ({
        focus: () => setLastTab(route.name),
      })}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.foreground,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.colors.raisedSurface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: theme.type.labelCaps,
      }}
    >
      {TAB_NAMES.map((name) => (
        <Tab.Screen key={name} name={name} component={TAB_STACKS[name]} />
      ))}
    </Tab.Navigator>
  );
}
