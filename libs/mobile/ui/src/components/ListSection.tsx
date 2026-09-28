import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ListSectionProps {
  title: string;
  /** A count, a total — whatever the section is summarised by. */
  meta?: string;
  /** Gives the header a disclosure control. */
  collapsible?: boolean;
  /** Whether a collapsible section starts closed. */
  defaultCollapsed?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A titled group of rows, optionally collapsible.
 *
 * A collapsed section unmounts its rows rather than hiding them: a hidden
 * subtree stays in the accessibility tree on both platforms unless every row
 * inside it opts out, and a screen reader reading out the contents of a closed
 * section is the bug that shape produces.
 */
export function ListSection({
  title,
  meta,
  collapsible = false,
  defaultCollapsed = false,
  children,
  style,
}: ListSectionProps): React.JSX.Element {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  const header = (
    <View style={[styles.header, { gap: theme.spacing.sm }]}>
      {collapsible && (
        <Icon
          name={collapsed ? 'chevronRight' : 'chevronDown'}
          size={20}
          color="mutedForeground"
        />
      )}
      <Text variant="labelCaps" style={styles.title}>
        {title}
      </Text>
      {meta != null && <Text variant="caption">{meta}</Text>}
    </View>
  );

  return (
    <View
      style={[
        styles.section,
        {
          gap: theme.spacing.sm,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
        },
        style,
      ]}
    >
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => setCollapsed((value) => !value)}
          style={({ pressed }) => [
            { minHeight: MIN_TOUCH_TARGET },
            styles.headerPress,
            pressed && styles.pressed,
          ]}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      {!collapsed && children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
  },
  headerPress: {
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flexShrink: 1,
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
