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
  /**
   * A third way out, offered beside Confirm and Cancel — a Task's Delete
   * confirmation offers "Archive instead" here rather than asking the User to
   * cancel and find the archive action elsewhere. Omitting it leaves the
   * sheet exactly as it was: two buttons, not a blank third one.
   */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Shows a spinner on the confirm button and stops accepting either answer. */
  busy?: boolean;
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
  secondaryLabel,
  onSecondary,
  busy = false,
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
          busy={busy}
          onPress={onConfirm}
        />
        {secondaryLabel != null && onSecondary != null && (
          <Button
            label={secondaryLabel}
            variant="secondary"
            disabled={busy}
            onPress={onSecondary}
          />
        )}
        <Button
          label={cancelLabel}
          variant="ghost"
          disabled={busy}
          onPress={onCancel}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'column',
  },
});
