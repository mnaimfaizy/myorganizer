import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  /** What confirming will do, including anything it cannot undo. */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm button as destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The one shape every "are you sure" in the app takes.
 *
 * Cancel comes second and is the sheet's dismissal, so the safe answer is the
 * one the User reaches by doing nothing — tapping the scrim, or pressing back.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onDismiss={onCancel} title={title}>
      <Text variant="body" color="mutedForeground">
        {message}
      </Text>
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <Button
          label={confirmLabel}
          variant={destructive ? 'destructive' : 'primary'}
          onPress={onConfirm}
        />
        <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'column',
  },
});
