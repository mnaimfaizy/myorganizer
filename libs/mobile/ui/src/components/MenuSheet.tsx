import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { BottomSheet } from './BottomSheet';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface MenuSheetItem {
  /** Stable within the sheet. */
  id: string;
  label: string;
  icon?: IconName;
  /** Renders the label and glyph in the destructive Semantic Role. */
  destructive?: boolean;
  onPress: () => void;
}

export interface MenuSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  items: readonly MenuSheetItem[];
}

/**
 * The one shape every "⋯" overflow menu in the app takes — a list of named
 * actions, each dismissing the sheet before it runs. Where `ConfirmSheet` is
 * the app's one "are you sure", this is its one "which one": neither is the
 * other with different labels, because a menu item that itself needed
 * confirming opens a `ConfirmSheet` of its own once this one closes rather
 * than growing a second button per row here.
 */
export function MenuSheet({
  visible,
  onDismiss,
  title,
  items,
}: MenuSheetProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title={title}>
      <View style={{ gap: theme.spacing.xs }}>
        {items.map((item) => {
          const color = item.destructive ? 'destructive' : 'foreground';
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                onDismiss();
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: MIN_TOUCH_TARGET,
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radii.md,
                },
                pressed && { backgroundColor: theme.colors.secondary },
              ]}
            >
              {item.icon != null && (
                <Icon name={item.icon} size={20} color={color} />
              )}
              <Text variant="body" color={color}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
