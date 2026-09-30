import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import type { IconName } from './Icon';
import { Text } from './Text';

export interface ConfirmSheetProps {
  visible: boolean;
  /** A question — "Delete this task?", "Turn off Biometric Unlock?". */
  title: string;
  /**
   * What confirming will do, including anything it cannot undo. Several
   * strings render as separate paragraphs (Log out says what it removes, then
   * what it keeps).
   */
  message: string | readonly string[];
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Renders the confirm button as destructive. Only for something that
   * cannot be undone; a reversible confirmation ("Turn off", "Remove Checked
   * From List") stays `primary`.
   */
  destructive?: boolean;
  /**
   * A third way out, offered between Confirm and Cancel — a Task's Delete
   * confirmation offers "Archive instead" here rather than asking the User to
   * cancel and find the archive action elsewhere. With it, Cancel steps down
   * from a secondary button to a ghost one, as drawn. Omitting it leaves the
   * sheet exactly as it was: two buttons, not a blank third one.
   */
  secondaryLabel?: string;
  /** The third way out's glyph — `archive` for "Archive instead". */
  secondaryIcon?: IconName;
  onSecondary?: () => void;
  /** Shows a spinner on the confirm button and stops accepting either answer. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The one shape every "are you sure" in the app takes.
 *
 * Cancel comes last and is the sheet's dismissal, so the safe answer is the
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
  secondaryIcon,
  onSecondary,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps): React.JSX.Element {
  const theme = useTheme();
  const paragraphs = typeof message === 'string' ? [message] : message;
  const hasAlternative = secondaryLabel != null && onSecondary != null;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={busy ? () => undefined : onCancel}
      title={title}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          {paragraphs.map((paragraph) => (
            // `popoverForeground` is the body colour the sheet draws: the
            // foreground in light, and in dark a quieter grey under the
            // near-white title.
            <Text key={paragraph} variant="bodySm" color="popoverForeground">
              {paragraph}
            </Text>
          ))}
        </View>
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>
          <Button
            label={confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
            busy={busy}
            onPress={onConfirm}
          />
          {hasAlternative && (
            <Button
              label={secondaryLabel}
              variant="secondary"
              icon={secondaryIcon}
              disabled={busy}
              onPress={onSecondary}
            />
          )}
          <Button
            label={cancelLabel}
            variant={hasAlternative ? 'ghost' : 'secondary'}
            disabled={busy}
            onPress={onCancel}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'column',
  },
});
