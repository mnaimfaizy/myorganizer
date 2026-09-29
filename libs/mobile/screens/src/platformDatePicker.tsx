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
 * Opens the Material 3 date dialog (Android) — "Select date", Cancel and OK,
 * and typing a date by hand from its pencil (Platform notes). `onPicked`
 * receives the chosen day at local midnight; `onClose` runs however the
 * dialog closed.
 *
 * Material's picker selects a UTC day, and the library hands it the local
 * instant as it is: east of UTC the calendar opened on yesterday, and west
 * of UTC the day picked came back as the day before. So the day goes in as
 * UTC midnight, in UTC, and comes back out of the UTC fields.
 */
export function openDialogDatePicker(options: {
  value: Date;
  minimumDate?: Date;
  onPicked: (date: Date) => void;
  onClose?: () => void;
}): void {
  DateTimePickerAndroid.open({
    value: utcMidnightOf(options.value),
    mode: 'date',
    design: 'material',
    title: 'Select date',
    timeZoneName: 'UTC',
    minimumDate:
      options.minimumDate != null
        ? utcMidnightOf(options.minimumDate)
        : undefined,
    onChange: (event, picked) => {
      if (event.type === 'set' && picked != null) {
        options.onPicked(
          new Date(
            picked.getUTCFullYear(),
            picked.getUTCMonth(),
            picked.getUTCDate(),
          ),
        );
      }
      options.onClose?.();
    },
  });
}

/** The local calendar day of `date`, as that day's midnight in UTC. */
function utcMidnightOf(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}
