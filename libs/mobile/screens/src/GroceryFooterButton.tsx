import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, useTheme } from '@myorganizer/mobile/ui';

export interface GroceryFooterButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * The Groceries screens' one primary action, pinned above the tab bar — "New
 * list" on the Grocery Lists, "Add item" on a trip (#908 story 33: an Add
 * button within thumb reach at the bottom, so adding does not need two hands).
 *
 * A full-width 56pt button on the page background, under a hairline, outside
 * the scroll view so it never scrolls away.
 */
export function GroceryFooterButton({
  label,
  onPress,
  disabled = false,
}: GroceryFooterButtonProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.footer,
        {
          // The sheet pads the bar 12 top and bottom, exactly between the
          // `sm` and `md` steps; a tie rounds up.
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <Button
        label={label}
        icon="plus"
        size="large"
        disabled={disabled}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
