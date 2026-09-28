import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  /** A glyph above the title. Decorative. */
  icon?: IconName;
  /** What is not here, stated as a fact rather than as an apology. */
  title: string;
  /** How to put something here. */
  description?: string;
  /** The way out of the empty state. */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/**
 * What a list shows when it has nothing in it.
 *
 * Always something, never a blank screen: an empty area is not
 * distinguishable from a screen that failed to load, and the User's next move
 * differs completely between the two.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.content, { gap: theme.spacing.sm }, style]}>
      {icon != null && <Icon name={icon} size={32} color="mutedForeground" />}
      <Text variant="title" style={styles.centered}>
        {title}
      </Text>
      {description != null && (
        <Text variant="bodySm" style={styles.centered}>
          {description}
        </Text>
      )}
      {actionLabel != null && onAction != null && (
        <Button
          label={actionLabel}
          variant="secondary"
          onPress={onAction}
          style={{ marginTop: theme.spacing.sm }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
