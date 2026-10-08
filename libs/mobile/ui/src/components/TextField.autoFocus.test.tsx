import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { TextField, type TextFieldProps } from './TextField';

async function renderField(props: TextFieldProps): Promise<void> {
  await render(
    <ThemeProvider appearance="light">
      <TextField testID="field" {...props} />
    </ThemeProvider>,
  );
}

/** The wait an Android field takes before focusing itself. */
const WAIT_MS = 300;

/** How many focuses are still owed after that wait. */
function waitsOwed(): number {
  return jest
    .mocked(setTimeout)
    .mock.calls.filter(([, delay]) => delay === WAIT_MS).length;
}

/** Whether the input itself is told to take focus as it mounts. */
function focusesAsItMounts(): boolean {
  return screen.getByTestId('field').props.autoFocus === true;
}

describe('TextField autoFocus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'setTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('on Android', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('waits before focusing, so a sheet can show a keyboard for it', async () => {
      await renderField({ autoFocus: true });

      expect(focusesAsItMounts()).toBe(false);
      expect(waitsOwed()).toBe(1);
    });

    it('focuses as it mounts when asked to promptly, with no wait owed', async () => {
      await renderField({ autoFocus: true, autoFocusPromptly: true });

      expect(focusesAsItMounts()).toBe(true);
      expect(waitsOwed()).toBe(0);
    });

    it('does not focus a field that was only asked to be prompt', async () => {
      await renderField({ autoFocusPromptly: true });

      expect(focusesAsItMounts()).toBe(false);
      expect(waitsOwed()).toBe(0);
    });
  });

  it('focuses as it mounts on iOS either way', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderField({ autoFocus: true });

    expect(focusesAsItMounts()).toBe(true);
    expect(waitsOwed()).toBe(0);
  });
});
