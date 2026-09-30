import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { openDialogDatePicker } from './platformDatePicker';

// The library ships Flow source and a native module; only the imperative
// Android API is under test, and only as what it is handed.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

const open = DateTimePickerAndroid.open as jest.Mock;

type OpenArgs = {
  value: Date;
  minimumDate?: Date;
  design: string;
  timeZoneName: string;
  title: string;
  onChange: (event: { type: string }, date?: Date) => void;
};

function lastOpen(): OpenArgs {
  return open.mock.calls[open.mock.calls.length - 1][0] as OpenArgs;
}

beforeEach(() => open.mockClear());

describe('openDialogDatePicker', () => {
  it('opens the Material dialog on the local day, as that day in UTC', () => {
    openDialogDatePicker({
      value: new Date(2026, 8, 30, 8, 29),
      minimumDate: new Date(2026, 8, 1, 23, 59),
      onPicked: jest.fn(),
    });

    const args = lastOpen();
    expect(args.design).toBe('material');
    expect(args.title).toBe('Select date');
    expect(args.timeZoneName).toBe('UTC');
    expect(args.value.getTime()).toBe(Date.UTC(2026, 8, 30));
    expect(args.minimumDate?.getTime()).toBe(Date.UTC(2026, 8, 1));
  });

  it('hands back the picked day at local midnight, whatever the time zone', () => {
    const onPicked = jest.fn();
    const onClose = jest.fn();
    openDialogDatePicker({
      value: new Date(2026, 8, 30),
      onPicked,
      onClose,
    });

    lastOpen().onChange({ type: 'set' }, new Date(Date.UTC(2026, 9, 14)));

    expect(onPicked).toHaveBeenCalledWith(new Date(2026, 9, 14));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('picks nothing when the dialog is dismissed, and still closes', () => {
    const onPicked = jest.fn();
    const onClose = jest.fn();
    openDialogDatePicker({
      value: new Date(2026, 8, 30),
      onPicked,
      onClose,
    });

    lastOpen().onChange({ type: 'dismissed' }, new Date(Date.UTC(2026, 8, 30)));

    expect(onPicked).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
