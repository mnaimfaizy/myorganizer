import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { MIN_TOUCH_TARGET, TAB_LABEL_SCALE_CAP } from '../metrics';
import { fontCutFor } from '../typeScale';
import { useFocusRing } from '../hooks/useFocusRing';
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
      testID="tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          paddingHorizontal: theme.spacing.xs,
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      {items.map((item) => (
        <Tab
          key={item.key}
          item={item}
          active={item.key === activeKey}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

/**
 * One tab: the indicator slot with its glyph, and the name under it.
 *
 * State is carried three ways, so it never depends on colour alone: the
 * active tab fills its indicator with `cyan` and draws its glyph in
 * `cyan-foreground` at a heavier stroke, and its label turns bold. A pressed
 * tab fills the same slot with `accent` instead of fading — the slot is the
 * tab's state layer, on both platforms.
 */
function Tab({
  item,
  active,
  onSelect,
}: {
  item: TabBarItem;
  active: boolean;
  onSelect: (key: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const focus = useFocusRing('inset');

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityState={{ selected: active }}
      onPress={() => onSelect(item.key)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[
        styles.tab,
        {
          minHeight: Math.max(TAB_HEIGHT, MIN_TOUCH_TARGET),
          gap: theme.spacing.xs,
          // The sheet draws the tab button and its indicator at 10, which
          // falls exactly between the `md` and `lg` radius steps; a tie
          // rounds up.
          borderRadius: theme.radii.lg,
        },
        focus.ringStyle,
      ]}
    >
      {({ pressed }) => (
        <>
          <View
            testID={`tab-indicator-${item.key}`}
            style={[
              styles.indicator,
              {
                borderRadius: theme.radii.lg,
                backgroundColor: active
                  ? theme.colors.cyan
                  : pressed
                    ? theme.colors.accent
                    : 'transparent',
              },
            ]}
          >
            <Icon
              name={item.icon}
              size={ICON_SIZE}
              color={active ? 'cyanForeground' : 'mutedForeground'}
              strokeWidth={active ? ACTIVE_STROKE : INACTIVE_STROKE}
            />
          </View>
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
        </>
      )}
    </Pressable>
  );
}

/**
 * The Navigation sheet's tab geometry. A tab is 60 tall — the 30pt
 * indicator, a 4pt gap, and a 14pt label, centred — and its indicator is a
 * 56 × 30 pill carrying a 22pt glyph. These are component dimensions, like the
 * touch target, rather than spacing: no step of the scale is any of them.
 */
const TAB_HEIGHT = 60;
const INDICATOR_WIDTH = 56;
const INDICATOR_HEIGHT = 30;
const ICON_SIZE = 22;
const ACTIVE_STROKE = 2.4;
const INACTIVE_STROKE = 2;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
  },
});
