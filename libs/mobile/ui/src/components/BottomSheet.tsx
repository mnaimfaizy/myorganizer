import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  /** Called for a tap on the scrim and for the Android hardware back button. */
  onDismiss: () => void;
  /** The sheet's own title. Also what the sheet is announced as. */
  title?: string;
  children?: React.ReactNode;
}

/**
 * A panel that comes up over the screen and takes the interaction until it is
 * answered.
 *
 * It is the one thing in the app that covers the tab bar, and that is the
 * whole of the rule: the bar stays on every screen pushed inside a tab, and
 * hides only for a sheet or a form like this one.
 *
 * `accessibilityViewIsModal` is what keeps a screen reader inside the panel;
 * without it the list behind the scrim is still swipeable, and the User can
 * act on a row they cannot see.
 */
export function BottomSheet({
  visible,
  onDismiss,
  title,
  children,
}: BottomSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      // Reduce Motion takes the travel, not the sheet: it still appears and
      // still covers what it covered, without sliding up to do it.
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onDismiss}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
        onPress={onDismiss}
      />
      <View
        accessibilityViewIsModal
        accessibilityLabel={title}
        style={[
          styles.sheet,
          {
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.lg + insets.bottom,
            borderTopLeftRadius: theme.radii['2xl'],
            borderTopRightRadius: theme.radii['2xl'],
            backgroundColor: theme.colors.popover,
          },
        ]}
      >
        <View
          style={[
            styles.grabber,
            {
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.border,
            },
          ]}
        />
        {title != null && <Text variant="title">{title}</Text>}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    marginTop: 'auto',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
  },
});
