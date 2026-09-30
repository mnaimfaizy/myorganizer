import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { LockAction } from './LockAction';
import { Text } from './Text';

export interface LargeTitleHeaderProps {
  title: string;
  /** Locks the Vault. Omitted on a screen reached before the Vault is open. */
  onLock?: () => void;
  /** What the lock control is announced as. */
  lockLabel?: string;
  /** An extra control before the lock action. */
  trailing?: React.ReactNode;
  /**
   * Whether the screen has scrolled past the title. Collapsed, the title moves
   * inline into the action bar and a hairline appears under it. Drive it with
   * `useLargeTitleCollapse` on the screen's scroll view.
   */
  collapsed?: boolean;
  style?: ViewStyle;
}

/**
 * The collapsed bar's height per platform (Platform sheet): Android's is a
 * Material top app bar, 64 dp with the title left-aligned; iOS's is the
 * navigation bar, 52 pt with the title centred. Component dimensions, like
 * the touch target — no step of the spacing scale is either.
 */
const COLLAPSED_HEIGHT = Platform.OS === 'android' ? 64 : 52;

/**
 * A screen's own large title, with Lock as the trailing action.
 *
 * This is the Android half of the pair: iOS gets the same thing from the
 * native stack's large title, which collapses into the navigation bar as the
 * screen scrolls and cannot be reproduced faithfully in JavaScript. Android's
 * native stack has no equivalent, so the header is drawn here — same title,
 * same trailing action, same place on the screen.
 *
 * Expanded, it is the Navigation sheet's two rows: a 44pt action row with
 * Lock at the trailing edge, and the `display` title under it. Collapsed, the
 * title moves inline — left-aligned at the Material top app bar's 64 dp on
 * Android, centred on iOS — and a hairline appears under the bar.
 */
export function LargeTitleHeader({
  title,
  onLock,
  lockLabel = 'Lock vault',
  trailing,
  collapsed = false,
  style,
}: LargeTitleHeaderProps): React.JSX.Element {
  const theme = useTheme();

  const actions = (
    <>
      {trailing}
      {onLock != null && (
        <LockAction onPress={onLock} accessibilityLabel={lockLabel} />
      )}
    </>
  );

  if (collapsed) {
    const centred = Platform.OS === 'ios';
    return (
      <View
        accessibilityRole="header"
        style={[
          styles.bar,
          {
            minHeight: COLLAPSED_HEIGHT,
            gap: theme.spacing.sm,
            paddingLeft: centred ? theme.spacing.sm : theme.spacing.md,
            paddingRight: theme.spacing.sm,
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
          style,
        ]}
      >
        {centred && <View style={styles.balance} />}
        {/* The sheet sets the inline title at 17/600 on iOS — `body` at
            600 — and 22/28/700 on Android, which no step carries; it takes
            `title` (20/26/700), the nearest. */}
        <Text
          variant={centred ? 'body' : 'title'}
          weight={centred ? 'semibold' : undefined}
          numberOfLines={1}
          style={[styles.inlineTitle, centred && styles.centred]}
        >
          {title}
        </Text>
        <View style={styles.actions}>{actions}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          paddingTop: theme.spacing.xs,
          paddingRight: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          paddingLeft: theme.spacing.md,
          backgroundColor: theme.colors.background,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.actions,
          styles.actionRow,
          { minHeight: MIN_TOUCH_TARGET, gap: theme.spacing.sm },
        ]}
      >
        {actions}
      </View>
      <Text
        variant="display"
        accessibilityRole="header"
        numberOfLines={2}
        style={{ paddingRight: theme.spacing.sm }}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineTitle: {
    flexGrow: 1,
    flexShrink: 1,
  },
  centred: {
    textAlign: 'center',
  },
  // Balances the trailing actions so a centred title is centred on the bar,
  // not on the space the actions leave.
  balance: {
    width: MIN_TOUCH_TARGET,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    justifyContent: 'flex-end',
  },
});
