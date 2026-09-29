import React, { useState } from 'react';
import { Platform } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { getDeviceSettings, setLastTab } from '@myorganizer/mobile/core';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import { LockAction, TabBar } from '@myorganizer/mobile/ui';
import { AccountScreen } from './AccountScreen';
import { DetailsScreen } from './DetailsScreen';
import { GroceriesScreen } from './GroceriesScreen';
import { GroceryTripScreen } from './GroceryTripScreen';
import { GROCERIES_ROUTES } from './groceriesStack';
import { SubscriptionsScreen } from './SubscriptionsScreen';
import { TasksScreen } from './TasksScreen';
import {
  DEFAULT_TAB,
  isTabName,
  TAB_META,
  TAB_NAMES,
  type MainTabParamList,
  type TabName,
} from './tabs';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** One screen pushed inside a tab, above that tab's home screen. */
interface PushedScreen {
  name: string;
  component: React.ComponentType;
  options?: NativeStackNavigationOptions;
}

/**
 * What a pushed screen's header looks like: drawn on both platforms, because
 * the back affordance is the way out of it, and without the large title,
 * which belongs to a tab's root and not to a screen inside it.
 */
const PUSHED_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  headerShown: true,
  headerLargeTitle: false,
};

/**
 * Wraps a tab's screen in its own native stack, so each tab keeps a
 * navigation history of its own: pushing inside Groceries and switching to
 * Tasks leaves Groceries where it was.
 *
 * Built once per tab at module scope rather than inside a render, because a
 * navigator created during render is a new component type on every render and
 * remounts the whole tab.
 *
 * The header options here are the iOS half of the title rule: the native large
 * title, with Lock trailing it. On Android `headerShown` is false and the
 * screen draws `TabScreenHeader` instead — but a *pushed* screen shows the
 * native header on both, which is where its back affordance comes from.
 */
function tabStack(
  name: TabName,
  Screen: React.ComponentType,
  pushed: readonly PushedScreen[] = [],
): React.ComponentType {
  const Stack =
    createNativeStackNavigator<Record<string, object | undefined>>();

  function TabStack(): React.JSX.Element {
    const { lock } = useVaultSession();

    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: Platform.OS === 'ios',
          headerLargeTitle: true,
          title: TAB_META[name].label,
          headerRight: () => <LockAction onPress={() => lock('manual')} />,
        }}
      >
        <Stack.Screen name={`${name}Home`} component={Screen} />
        {pushed.map((screen) => (
          <Stack.Screen
            key={screen.name}
            name={screen.name}
            component={screen.component}
            options={{ ...PUSHED_SCREEN_OPTIONS, ...screen.options }}
          />
        ))}
      </Stack.Navigator>
    );
  }
  TabStack.displayName = `${name}TabStack`;
  return TabStack;
}

/** One stack per tab, pinned to the tab list so neither side can drift. */
const TAB_STACKS = {
  Groceries: tabStack('Groceries', GroceriesScreen, [
    { name: GROCERIES_ROUTES.trip, component: GroceryTripScreen },
  ]),
  Tasks: tabStack('Tasks', TasksScreen),
  Subscriptions: tabStack('Subscriptions', SubscriptionsScreen),
  Details: tabStack('Details', DetailsScreen),
  Account: tabStack('Account', AccountScreen),
} as const satisfies Record<TabName, React.ComponentType>;

/** The bar's items, in tab order, built from the one tab vocabulary. */
const TAB_BAR_ITEMS = TAB_NAMES.map((name) => ({
  key: name,
  label: TAB_META[name].label,
  icon: TAB_META[name].icon,
}));

/**
 * The app's bottom bar, wired to the navigator.
 *
 * It is drawn by this app's own `TabBar` rather than by React Navigation's,
 * which is what supplies the five glyphs and the labels the design sheet
 * specifies — #909's interim bar had neither, so React Navigation drew its
 * default placeholder glyph on every tab and truncated two of the five names.
 *
 * Because the bar belongs to the tab navigator and not to any screen inside
 * it, **it stays visible on every screen pushed within a tab**. Nothing here
 * hides it, and nothing should: the only things that cover it are modal
 * presentations — a `BottomSheet`, a form presented from the root stack, the
 * keyboard — which is the platform convention and one rule with no per-feature
 * exception.
 */
function AppTabBar({
  state,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  return (
    <TabBar
      items={TAB_BAR_ITEMS}
      activeKey={state.routes[state.index].name}
      onSelect={(key) => {
        const route = state.routes.find((candidate) => candidate.name === key);
        if (route === undefined) return;
        // Emitted rather than navigated to directly, so that a screen
        // listening for a re-press of the tab it is already on — to scroll to
        // the top, or to pop its stack — still hears it.
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented) navigation.navigate(route.name);
      }}
    />
  );
}

/** The signed-in, unlocked app: five tabs, each owning a stack. */
export function MainTabs(): React.JSX.Element {
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
      tabBar={(props) => <AppTabBar {...props} />}
      screenListeners={({ route }) => ({
        focus: () => setLastTab(route.name),
      })}
      screenOptions={{ headerShown: false }}
    >
      {TAB_NAMES.map((name) => (
        <Tab.Screen key={name} name={name} component={TAB_STACKS[name]} />
      ))}
    </Tab.Navigator>
  );
}
