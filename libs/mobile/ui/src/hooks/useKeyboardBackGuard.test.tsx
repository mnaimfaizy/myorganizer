import React from 'react';
import { Keyboard, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { BottomSheet } from '../components/BottomSheet';
import { Text } from '../components/Text';
import {
  closeRequestHidesKeyboardOnly,
  KEYBOARD_BACK_GRACE_MS,
} from './useKeyboardBackGuard';

describe('closeRequestHidesKeyboardOnly', () => {
  it('should spend the request on a keyboard that is up', () => {
    expect(
      closeRequestHidesKeyboardOnly({ visible: true, hiddenAt: null }, 1000),
    ).toBe(true);
  });

  it('should close the sheet when the keyboard was never up', () => {
    expect(
      closeRequestHidesKeyboardOnly({ visible: false, hiddenAt: null }, 1000),
    ).toBe(false);
  });

  it('should spend the request on a keyboard that has only just gone', () => {
    expect(
      closeRequestHidesKeyboardOnly(
        { visible: false, hiddenAt: 1000 },
        1000 + KEYBOARD_BACK_GRACE_MS,
      ),
    ).toBe(true);
  });

  it('should close the sheet once the keyboard has been down a while', () => {
    expect(
      closeRequestHidesKeyboardOnly(
        { visible: false, hiddenAt: 1000 },
        1001 + KEYBOARD_BACK_GRACE_MS,
      ),
    ).toBe(false);
  });
});

/**
 * Through BottomSheet, whose Modal is what Android's Back and Escape reach
 * (#949). The keyboard's events are the ones React Native would emit.
 *
 * Nothing here says which text input holds focus, because on a device the
 * guard cannot use it: by the time Escape's close request arrives, the
 * sheet's field has already lost focus and React Native reports none.
 */
describe('useKeyboardBackGuard, through BottomSheet', () => {
  type Listener = () => void;
  let listeners: Record<string, Listener[]>;
  let now: number;

  const emit = async (
    event: 'keyboardDidShow' | 'keyboardDidHide',
  ): Promise<void> => {
    await act(async () => {
      for (const listener of listeners[event] ?? []) listener();
    });
  };

  const sheet = (
    onDismiss: () => void,
    visible: boolean,
  ): React.JSX.Element => (
    <ThemeProvider appearance="light">
      <BottomSheet visible={visible} onDismiss={onDismiss} title="New list">
        <Text>Name</Text>
      </BottomSheet>
    </ThemeProvider>
  );

  const renderSheet = async (onDismiss: () => void): Promise<void> => {
    await render(sheet(onDismiss, true));
  };

  // The Modal's host view: the nearest view above the sheet's content that
  // takes the request Android makes for Back and Escape.
  const pressBack = async (): Promise<void> => {
    let view = screen.getByText('Name', { includeHiddenElements: true }).parent;
    while (view !== null && view.props.onRequestClose === undefined) {
      view = view.parent;
    }
    if (view === null) throw new Error('No Modal above the sheet content');
    await fireEvent(view, 'requestClose');
  };

  const useAndroid = (): void => {
    jest.replaceProperty(Platform, 'OS', 'android');
  };

  beforeEach(() => {
    listeners = {};
    now = 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      listener: Listener,
    ) => {
      (listeners[event] ??= []).push(listener);
      return {
        remove: () => {
          listeners[event] = (listeners[event] ?? []).filter(
            (held) => held !== listener,
          );
        },
      };
    }) as unknown as typeof Keyboard.addListener);
  });
  afterEach(() => jest.restoreAllMocks());

  it('should close the sheet on Back when the keyboard is down', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('should hide the keyboard and keep the sheet on the first Back, then close on the second', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await emit('keyboardDidShow');

    await pressBack();
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    // The keyboard this guard sent away starts no grace period of its own.
    await emit('keyboardDidHide');
    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  it('should close on a second press that arrives before the keyboard has reported gone', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await emit('keyboardDidShow');
    await pressBack();
    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should keep the sheet when the press that hid the keyboard reaches it just after', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await emit('keyboardDidShow');
    await emit('keyboardDidHide');
    now += 80;

    await pressBack();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(Keyboard.dismiss).not.toHaveBeenCalled();

    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should close on Back once the keyboard has been down past the grace period', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await emit('keyboardDidShow');
    await emit('keyboardDidHide');
    now += KEYBOARD_BACK_GRACE_MS + 1;
    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should close a picker opened from a field on a Back just after that field’s keyboard went (#1091)', async () => {
    useAndroid();
    // The composer's keyboard is up as the picker opens.
    jest.mocked(Keyboard.isVisible).mockReturnValue(true);
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    // The sheet took the window focus, and Android hid the keyboard.
    await emit('keyboardDidHide');
    now += 80;

    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('should close a picker on Back while the keyboard behind it is still reported up', async () => {
    useAndroid();
    jest.mocked(Keyboard.isVisible).mockReturnValue(true);
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);

    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('should guard a sheet opened from a field once its own field has brought the keyboard back', async () => {
    useAndroid();
    jest.mocked(Keyboard.isVisible).mockReturnValue(true);
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await emit('keyboardDidHide');
    await emit('keyboardDidShow');

    await pressBack();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  it('should not count a keyboard that came up before the sheet opened, however long the sheet has been mounted', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    // Mounted hidden, as a screen mounts its sheets.
    await render(sheet(onDismiss, false));
    await emit('keyboardDidShow');
    await screen.rerender(sheet(onDismiss, true));
    await emit('keyboardDidHide');
    now += 80;

    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should forget the keyboard of the last time the sheet was open', async () => {
    useAndroid();
    const onDismiss = jest.fn();
    await render(sheet(onDismiss, true));
    await emit('keyboardDidShow');
    // Closed with its keyboard still up, by its own button.
    await screen.rerender(sheet(onDismiss, false));
    await emit('keyboardDidHide');
    await screen.rerender(sheet(onDismiss, true));

    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('should leave iOS as it was', async () => {
    jest.mocked(Keyboard.isVisible).mockReturnValue(true);
    const onDismiss = jest.fn();
    await renderSheet(onDismiss);
    await emit('keyboardWillShow' as 'keyboardDidShow');
    await pressBack();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });
});
