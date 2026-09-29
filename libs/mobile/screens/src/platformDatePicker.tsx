// The native date picker behind DateField: @react-native-community/datetimepicker.
// Split out so the web target can swap it (./platformDatePicker.web.tsx) —
// the library ships Flow source that Vite cannot parse, and react-native-web
// has no native picker to show.
import React from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import type { ColorMode } from '@myorganizer/mobile/ui';

export interface InlineDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  accentColor: string;
  mode: ColorMode;
}

/** The system inline calendar (iOS), shown inside the date sheet. */
export function InlineDatePicker({
  value,
  onChange,
  minimumDate,
  accentColor,
  mode,
}: InlineDatePickerProps): React.JSX.Element {
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="inline"
      minimumDate={minimumDate}
      accentColor={accentColor}
      themeVariant={mode}
      onChange={(_event, picked) => {
        if (picked != null) onChange(picked);
      }}
    />
  );
}

/**
 * Opens the Material date dialog (Android). `onPicked` receives the chosen day,
 * or `null` when the dialog was dismissed; `onClose` runs either way.
 */
export function openDialogDatePicker(options: {
  value: Date;
  minimumDate?: Date;
  onPicked: (date: Date) => void;
  onClose?: () => void;
}): void {
  DateTimePickerAndroid.open({
    value: options.value,
    mode: 'date',
    minimumDate: options.minimumDate,
    onChange: (event, picked) => {
      if (event.type === 'set' && picked != null) options.onPicked(picked);
      options.onClose?.();
    },
  });
}
