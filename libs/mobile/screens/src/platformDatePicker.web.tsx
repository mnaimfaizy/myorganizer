// Web variant of ./platformDatePicker, selected by the Vite `resolve.extensions`
// list in apps/mobile/vite.config.mts ('.web.tsx' precedes '.tsx'). The
// react-native-web preview has no native calendar, and the library's Flow
// source cannot be bundled, so the date sheet takes the day as typed text.
import React, { useState } from 'react';
import { TextField, type ColorMode } from '@myorganizer/mobile/ui';
import { parseCalendarDate, toCalendarDate } from './calendarDate';

export interface InlineDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  accentColor: string;
  mode: ColorMode;
}

export function InlineDatePicker({
  value,
  onChange,
}: InlineDatePickerProps): React.JSX.Element {
  const [text, setText] = useState(toCalendarDate(value));
  return (
    <TextField
      label="Date"
      hint="YYYY-MM-DD"
      value={text}
      autoCapitalize="none"
      autoCorrect={false}
      onChangeText={(next) => {
        setText(next);
        const date = parseCalendarDate(next);
        if (date != null) onChange(date);
      }}
    />
  );
}

/** Never reached on web: the date sheet is used instead of a dialog. */
export function openDialogDatePicker(options: {
  value: Date;
  minimumDate?: Date;
  onPicked: (date: Date) => void;
  onClose?: () => void;
}): void {
  options.onClose?.();
}
