import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { MIN_TOUCH_TARGET, TAB_LABEL_SCALE_CAP } from '../metrics';
import { fontCutFor } from '../typeScale';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface TabBarItem {
  /** Identifies the tab. Handed back to `onSelect`. */
  key: string;
  /** What is printed under the icon. Must fit a fifth of the bar. */
  label: string;
  icon: IconName;
  /**
   * The tab's full name, for a screen reader. Defaults to the label, and is
   * given separately when the printed label is an abbreviation.
   */
  accessibilityLabel?: string;
}

export interface TabBarProps {
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/**
 * The bar itself: an icon and a name per tab.
 *
 * The label is the design sheet's own style — Inter 11/14, 500 inactive and
 * 700 active — rather than a Type Scale step, because no step is 11pt and the
 * bar is the one place in the app where the text has a hard width budget: five
 * labels share one screen. This is the one deliberate exception to "size text
 * with a step", and it is deliberate because the nearest step, `caption`, is
 * 12/16: taking it and then overriding the size, the line height, the tracking
 * and the cut would override all four of the attributes that make it a step,
 * which is the partial use the rule exists to prevent. Naming no step is
 * honest; naming one and keeping none of it is not. It still reaches its cut through the bundled-font
 * table rather than naming a file, and it scales with the OS text size only up
 * to 1.3×, past which the longest name would truncate rather than grow. The
 * full name stays reachable at any size through the tab's accessibility label.
 *
 * The bar takes the bottom safe-area inset itself, which is why a screen
 * inside a tab does not.
 *
 * It hides while the keyboard is up — one of the two cases in the tab bar
 * rule, alongside a modal sheet or form. That has to be done here: React
 * Navigation's `tabBarHideOnKeyboard` lives inside its own `BottomTabBar`, so
 * a navigator handed a custom bar never runs it, and the option reads as set
 * while nothing happens.
 */
export function TabBar({
  items,
  activeKey,
  onSelect,
}: TabBarProps): React.JSX.Element | null {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          backgroundColor: theme.colors.raisedSurface,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [
              styles.tab,
              {
                minHeight: MIN_TOUCH_TARGET,
                gap: theme.spacing.xs,
                paddingVertical: theme.spacing.xs,
                // The design sheet draws the tab button at 10, which falls
                // exactly between the `md` and `lg` radius steps; a tie rounds
                // up.
                borderRadius: theme.radii.lg,
              },
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={item.icon}
              size={24}
              color={active ? 'foreground' : 'mutedForeground'}
            />
            <Text
              color={active ? 'foreground' : 'mutedForeground'}
              maxFontSizeMultiplier={TAB_LABEL_SCALE_CAP}
              numberOfLines={1}
              style={[
                styles.label,
                {
                  fontFamily: fontCutFor('body', active ? '700' : '500'),
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
