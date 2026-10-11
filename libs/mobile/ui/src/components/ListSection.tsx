import React, { createContext, useContext, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Where a row sits in its section. A `ListRow` reads it to decide whether it
 * draws its inset divider: every row but the last does, because the section's
 * own bottom hairline closes the group.
 */
export interface ListRowPosition {
  last: boolean;
}

const RowPositionContext = createContext<ListRowPosition | null>(null);

/** The row's place in the enclosing section, or `null` outside one. */
export function useListRowPosition(): ListRowPosition | null {
  return useContext(RowPositionContext);
}

export interface ListSectionProps {
  title: string;
  /**
   * How many rows the section holds. Printed in the header as the Lists
   * sheet draws it — `TO BUY · 3` — in the same label-caps run as the title.
   */
  count?: number;
  /**
   * A short trailing note at the header's far edge — Account's "this phone".
   * Not the count: a count belongs in `count`, beside the title.
   */
  meta?: React.ReactNode;
  /**
   * Draws the heading in `warning` — a group that needs attention now, such
   * as the Tasks list's "Overdue · 1".
   */
  warning?: boolean;
  /**
   * Draws the rows as an inset card — in from the screen edge by the gutter,
   * edged and rounded, on the `card` elevation — as the Account and detail
   * sheets draw a settings group, instead of the Lists sheet's full-bleed run.
   */
  inset?: boolean;
  /** Gives the header a disclosure control. */
  collapsible?: boolean;
  /** Whether a collapsible section starts closed (uncontrolled). */
  defaultCollapsed?: boolean;
  /** Whether a collapsible section is closed, when the screen owns it. */
  collapsed?: boolean;
  /** Called with the next state when the header is pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  children?: React.ReactNode;
  /** `StyleProp` so a caller can merge a static entry with a theme value. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A titled group of rows, optionally collapsible — the Lists sheet's
 * full-bleed grouped list.
 *
 * The header sits on the screen's `background` in label caps; the rows sit on
 * `card` between a top and a bottom hairline, edge to edge, with no rounded
 * card around them. A collapsible header is one button carrying the expanded
 * state, with a trailing chevron that turns −90° when the section is closed.
 *
 * A collapsed section unmounts its rows rather than hiding them: a hidden
 * subtree stays in the accessibility tree on both platforms unless every row
 * inside it opts out, and a screen reader reading out the contents of a closed
 * section is the bug that shape produces.
 */
export function ListSection({
  title,
  count,
  meta,
  warning = false,
  inset = false,
  collapsible = false,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  children,
  style,
}: ListSectionProps): React.JSX.Element {
  const theme = useTheme();
  const press = usePressFeedback();
  const focus = useFocusRing('inset');
  const [collapsedState, setCollapsedState] = useState(
    collapsible && defaultCollapsed,
  );
  const collapsed = collapsible && (collapsedProp ?? collapsedState);
  const heading = count == null ? title : `${title} · ${count}`;

  const rows = React.Children.toArray(children);
  const content = rows.map((child, index) => (
    <RowPositionContext.Provider
      key={React.isValidElement(child) ? child.key : index}
      value={index === rows.length - 1 ? LAST : NOT_LAST}
    >
      {child}
    </RowPositionContext.Provider>
  ));

  const label = (
    <Text
      variant="labelCaps"
      color={warning ? 'warning' : undefined}
      accessibilityRole={collapsible ? undefined : 'header'}
      style={styles.title}
      numberOfLines={1}
    >
      {heading}
    </Text>
  );

  const trailing =
    meta == null ? null : typeof meta === 'string' ? (
      <Text variant="caption">{meta}</Text>
    ) : (
      meta
    );

  return (
    <View style={style}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={heading}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => {
            const next = !collapsed;
            if (collapsedProp == null) setCollapsedState(next);
            onCollapsedChange?.(next);
          }}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          android_ripple={focus.ripple(press.android_ripple)}
          style={({ pressed }) => [
            styles.header,
            styles.centred,
            {
              minHeight: MIN_TOUCH_TARGET,
              gap: theme.spacing.sm,
              paddingLeft: theme.spacing.md,
              // The sheet draws 12 here, exactly between the `sm` and `md`
              // spacing steps; a tie rounds up.
              paddingRight: theme.spacing.md,
            },
            press.pressedStyle(pressed),
            focus.ringStyle,
          ]}
        >
          {label}
          {trailing}
          <View
            testID="list-section-chevron"
            style={collapsed && styles.turned}
          >
            <Icon name="chevronDown" size={18} color="mutedForeground" />
          </View>
        </Pressable>
      ) : (
        <View
          style={[
            styles.header,
            styles.bottom,
            {
              minHeight: MIN_TOUCH_TARGET,
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
            },
          ]}
        >
          {label}
          {trailing}
        </View>
      )}
      {!collapsed && rows.length > 0 && !inset && (
        <View
          testID="list-section-rows"
          style={[
            styles.rows,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        >
          {content}
        </View>
      )}
      {!collapsed && rows.length > 0 && inset && (
        // The shadow sits on an outer view and the clip on an inner one: on
        // iOS `overflow: hidden` clips a view's own shadow away.
        <View
          testID="list-section-rows"
          style={[
            {
              marginHorizontal: theme.spacing.md,
              // The sheet rounds the card at 12: `lg`.
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.card,
            },
            theme.shadows.card,
          ]}
        >
          <View
            style={[
              styles.insetRows,
              {
                borderRadius: theme.radii.lg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {content}
          </View>
        </View>
      )}
    </View>
  );
}

/** Shared so a re-render does not hand every row a new context value. */
const LAST: ListRowPosition = { last: true };
const NOT_LAST: ListRowPosition = { last: false };

export interface ListSectionRowsProps {
  children?: React.ReactNode;
}

/**
 * A section's rows without its header: the full-bleed card band between two
 * hairlines, every row but the last drawing its inset divider — exactly the
 * band `ListSection` draws under its header.
 *
 * For a list whose headers are laid out apart from their rows — the grocery
 * trip view pins each category header as a sticky header of its scroll view,
 * which only a direct child of the scroll view can be — and for a run of rows
 * the design draws with no header at all (the Add sheet's results). Renders
 * nothing when it holds no rows.
 */
export function ListSectionRows({
  children,
}: ListSectionRowsProps): React.JSX.Element | null {
  const theme = useTheme();
  const rows = React.Children.toArray(children);
  if (rows.length === 0) return null;

  return (
    <View
      testID="list-section-rows"
      style={[
        styles.rows,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
      ]}
    >
      {rows.map((child, index) => (
        <RowPositionContext.Provider
          key={React.isValidElement(child) ? child.key : index}
          value={index === rows.length - 1 ? LAST : NOT_LAST}
        >
          {child}
        </RowPositionContext.Provider>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
  },
  centred: {
    alignItems: 'center',
  },
  bottom: {
    alignItems: 'flex-end',
  },
  title: {
    flexShrink: 1,
    flexGrow: 1,
  },
  turned: {
    transform: [{ rotate: '-90deg' }],
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  insetRows: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
