import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
import {
  FONT_FAMILY,
  LockAction,
  StackHeader,
  TabBar,
  useReturnFocusOnLeave,
  useTheme,
  type Theme,
} from '@myorganizer/mobile/ui';
import { AccountScreen } from './AccountScreen';
import { AddressDetailScreen } from './AddressDetailScreen';
import { DetailsScreen } from './DetailsScreen';
import { DETAILS_ROUTES } from './detailsStack';
import { GroceriesScreen } from './GroceriesScreen';
import { GroceryTripScreen } from './GroceryTripScreen';
import { GROCERIES_ROUTES } from './groceriesStack';
import { MobileNumberDetailScreen } from './MobileNumberDetailScreen';
import { SubscriptionDetailScreen } from './SubscriptionDetailScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';
import { SUBSCRIPTIONS_ROUTES } from './subscriptionsStack';
import { TaskDetailScreen } from './TaskDetailScreen';
import { TasksScreen } from './TasksScreen';
import { TASKS_ROUTES } from './tasksStack';
import { UsageLocationsScreen } from './UsageLocationsScreen';
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
 * What a pushed screen's header looks like on iOS: the native bar, whose back
 * affordance is the way out of it, without the large title, which belongs to
 * a tab's root and not to a screen inside it.
 *
 * Android turns the native bar off and draws the same bar itself — see
 * `PushedScreenLayout`.
 */
const PUSHED_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  headerShown: Platform.OS === 'ios',
  headerLargeTitle: false,
};

/**
 * A pushed screen on Android: this app's own bar, then the screen.
 *
 * The bar is drawn from the same options the native bar reads — `headerTitle`
 * over `title`, and `headerRight` — so a screen sets its header the one way on
 * both platforms. `headerShadowVisible` is the one it reads its own way: a
 * screen sets it while content is scrolled under the bar
 * (`useBarRuleOnScroll`), and the bar draws its rule from it.
 *
 * Two things about Android decide where it is drawn (#1029):
 *
 * - **Not by the native stack.** Its bar is an AppCompat `Toolbar`, which
 *   Android keeps out of the Tab order on a touchscreen device, so a hardware
 *   keyboard reached none of Back, Edit, "⋯", or Lock on any pushed screen
 *   (`StackHeader` has the mechanism).
 * - **Not through the stack's `header` option either.** React Navigation
 *   wraps that header in a view with `zIndex: 1`, and React Native mounts a
 *   raised view after its siblings. Android gives the first Tab on a screen
 *   to the first focusable view in mount order, so the first Tab landed in
 *   the content and the bar came last, after the tab bar. A screen layout has
 *   no such wrapper: the bar is mounted first and is the first stop.
 *
 * Leaving it hands focus back to the control that opened it, which Android
 * would otherwise give to the tab bar (#1034, `useReturnFocusOnLeave`).
 */
function PushedScreenLayout({
  children,
  navigation,
  options,
}: {
  children: React.ReactElement;
  navigation: { goBack: () => void };
  options: NativeStackNavigationOptions;
}): React.JSX.Element {
  useReturnFocusOnLeave();
  const title =
    typeof options.headerTitle === 'string'
      ? options.headerTitle
      : (options.title ?? '');

  return (
    <View style={styles.pushedScreen}>
      <StackHeader
        title={title}
        scrolledUnder={options.headerShadowVisible === true}
        onBack={navigation.goBack}
        trailing={options.headerRight?.({
          tintColor: options.headerTintColor,
          canGoBack: true,
        })}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pushedScreen: {
    flex: 1,
  },
});

/**
 * The native header's type and colour from the token theme, for both colour
 * modes.
 *
 * Only type and colour on iOS: the Navigation and Platform sheets draw the bar on
 * `background` with no hairline under the large title and a hairline once it
 * collapses, which is the platform's own default bar — and on iOS 26 setting
 * the bar background or the shadow options (`headerStyle`, `headerLargeStyle`,
 * `header*ShadowVisible`) stops the large title drawing at all, so they are
 * deliberately left to the platform. The inline title is 17/600 on iOS and
 * 22/28/700 on Android; the type scale has neither, so iOS takes the `body`
 * size in the 600 cut and Android the `title` step.
 */
function headerChrome(theme: Theme): NativeStackNavigationOptions {
  const inline =
    Platform.OS === 'ios'
      ? {
          fontFamily: FONT_FAMILY.bodySemiBold,
          fontSize: theme.type.body.fontSize,
        }
      : {
          fontFamily: theme.type.title.fontFamily,
          fontSize: theme.type.title.fontSize,
        };
  return {
    // Android has no platform bar to defer to: without a colour its native
    // header takes React Navigation's `card`, a white bar over a `background`
    // page, where the Platform sheet draws it on `background`. No
    // `headerShadowVisible` here: on Android that option is a pushed screen's
    // to set, per scroll position (`PushedScreenLayout`).
    ...(Platform.OS === 'android'
      ? { headerStyle: { backgroundColor: theme.colors.background } }
      : {}),
    headerTintColor: theme.colors.foreground,
    headerTitleStyle: { ...inline, color: theme.colors.foreground },
    headerLargeTitleStyle: {
      fontFamily: theme.type.display.fontFamily,
      fontSize: theme.type.display.fontSize,
      color: theme.colors.foreground,
    },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

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
 * screen draws `TabScreenHeader` instead; a *pushed* screen has a bar with a
 * back affordance on both — the native one on iOS, `PushedScreenLayout`'s on
 * Android.
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
    const theme = useTheme();

    return (
      <Stack.Navigator
        screenOptions={{
          ...headerChrome(theme),
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
            layout={
              Platform.OS === 'android'
                ? (props) => <PushedScreenLayout {...props} />
                : undefined
            }
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
  Tasks: tabStack('Tasks', TasksScreen, [
    { name: TASKS_ROUTES.detail, component: TaskDetailScreen },
  ]),
  Subscriptions: tabStack('Subscriptions', SubscriptionsScreen, [
    { name: SUBSCRIPTIONS_ROUTES.detail, component: SubscriptionDetailScreen },
  ]),
  Details: tabStack('Details', DetailsScreen, [
    { name: DETAILS_ROUTES.addressDetail, component: AddressDetailScreen },
    {
      name: DETAILS_ROUTES.mobileNumberDetail,
      component: MobileNumberDetailScreen,
    },
    { name: DETAILS_ROUTES.usageLocations, component: UsageLocationsScreen },
  ]),
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

/**
 * The signed-in, unlocked app: five tabs, each owning a stack.
 *
 * Android's system Back never moves between tabs (#1069). Inside a tab it
 * pops that tab's stack; on a tab's home screen it leaves the app, and the
 * last used tab is the one the app reopens on. React Navigation's default,
 * `firstRoute`, instead sent Back to the first tab in the bar — Groceries,
 * which is neither the tab the app opened on nor one the user came from.
 */
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
      backBehavior="none"
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
