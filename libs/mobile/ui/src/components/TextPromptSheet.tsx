import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { TextField } from './TextField';

export interface TextPromptSheetProps {
  visible: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  /** Prefilled and selected-in-place — a rename opens on the current name. */
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows a spinner on the confirm button and stops accepting input. */
  busy?: boolean;
  /** Given the trimmed value. Never called with an empty one. */
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/**
 * The one shape every "name this" prompt in the app takes — a single line of
 * text, confirmed or cancelled. A Grocery List's Create and Rename are the
 * same sheet with a different title and a different `initialValue`: creating
 * opens on nothing, renaming opens on what the list is already called.
 *
 * The draft is this sheet's own state rather than the caller's, so a caller
 * only ever hands it a starting value and reads back a finished one.
 */
export function TextPromptSheet({
  visible,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  busy = false,
  onSubmit,
  onCancel,
}: TextPromptSheetProps): React.JSX.Element {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);

  // Re-seeds the draft every time the sheet opens, so a Rename opened twice
  // on two different lists never shows the first one's leftover text.
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const submit = (): void => {
    if (trimmed.length > 0) onSubmit(trimmed);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onCancel} title={title}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={setValue}
        editable={!busy}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <Button
          label={confirmLabel}
          busy={busy}
          disabled={trimmed.length === 0}
          onPress={submit}
        />
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
