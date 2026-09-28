import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
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
  style?: ViewStyle;
}

/**
 * A screen's own large title, with Lock as the trailing action.
 *
 * This is the Android half of the pair: iOS gets the same thing from the
 * native stack's large title, which collapses into the navigation bar as the
 * screen scrolls and cannot be reproduced faithfully in JavaScript. Android's
 * native stack has no equivalent, so the header is drawn here — same title,
 * same trailing action, same place on the screen.
 */
export function LargeTitleHeader({
  title,
  onLock,
  lockLabel = 'Lock vault',
  trailing,
  style,
}: LargeTitleHeaderProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        },
        style,
      ]}
    >
      <Text variant="display" style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {trailing}
      {onLock != null && (
        <LockAction onPress={onLock} accessibilityLabel={lockLabel} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flexShrink: 1,
    flexGrow: 1,
  },
});
