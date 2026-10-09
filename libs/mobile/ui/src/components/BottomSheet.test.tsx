import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

describe('BottomSheet Component', () => {
  it('should dismiss from the scrim', async () => {
    const onDismiss = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider appearance="light">
        <BottomSheet visible onDismiss={onDismiss} title="Sort items by">
          <Text>Aisle</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    await user.press(
      screen.getByLabelText('Dismiss', { includeHiddenElements: true }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  /**
   * The scrim covers the sheet's whole window and comes first in it, so as a
   * keyboard stop it took the first Tab and drew its ring round the display
   * (#1028). On Android `accessible` and `focusable` are each a Tab stop, and
   * `focusable` is also the native click a screen reader's double-tap reaches
   * — hence the `activate` action that stands in for it.
   */
  describe('Scrim on Android', () => {
    const scrim = () =>
      screen.getByLabelText('Dismiss', { includeHiddenElements: true });

    const renderSheet = (onDismiss: () => void) =>
      render(
        <ThemeProvider appearance="light">
          <BottomSheet visible onDismiss={onDismiss} title="Sort items by">
            <Text>Aisle</Text>
          </BottomSheet>
        </ThemeProvider>,
      );

    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });
    afterEach(() => jest.restoreAllMocks());

    it('should be a screen reader stop and not a keyboard stop', async () => {
      await renderSheet(jest.fn());
      expect(scrim().props.accessible).toBe(false);
      expect(scrim().props.focusable).toBe(false);
      expect(scrim().props.screenReaderFocusable).toBe(true);
      expect(scrim().props.accessibilityRole).toBe('button');
    });

    it('should dismiss when a screen reader activates it', async () => {
      const onDismiss = jest.fn();
      await renderSheet(onDismiss);
      expect(scrim().props.accessibilityActions).toEqual([
        { name: 'activate' },
      ]);
      await fireEvent(scrim(), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should still dismiss from a tap', async () => {
      const onDismiss = jest.fn();
      const user = userEvent.setup();
      await renderSheet(onDismiss);
      await user.press(scrim());
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should draw no focus ring if it is sent focus', async () => {
      await renderSheet(jest.fn());
      await fireEvent(scrim(), 'focus');
      expect(StyleSheet.flatten(scrim().props.style).outlineWidth).toBe(
        undefined,
      );
    });
  });

  it('should leave the scrim an accessibility element on iOS', async () => {
    await render(
      <ThemeProvider appearance="light">
        <BottomSheet visible onDismiss={jest.fn()} title="Sort items by">
          <Text>Aisle</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    const scrim = screen.getByLabelText('Dismiss', {
      includeHiddenElements: true,
    });
    expect(scrim.props.accessible).toBe(true);
    expect(scrim.props.accessibilityActions).toBeUndefined();
  });

  it('should say the title once, as the header and not as the panel too (#1090)', async () => {
    await render(
      <ThemeProvider appearance="light">
        <BottomSheet visible onDismiss={jest.fn()} title="Sort items by">
          <Text>Aisle</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: 'Sort items by' })).toBeTruthy();
    expect(
      screen.getByTestId('sheet-panel').props.accessibilityLabel,
    ).toBeUndefined();
    expect(screen.queryByLabelText('Sort items by')).toBeNull();
  });

  it('should start the panel before the scrim on both sides, so a screen reader starts on it (#1090)', async () => {
    await render(
      <ThemeProvider appearance="light">
        <BottomSheet visible onDismiss={jest.fn()} title="Sort items by">
          <Text>Aisle</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    const panel = StyleSheet.flatten(
      screen.getByTestId('sheet-panel').props.style,
    );
    const scrim = StyleSheet.flatten(
      screen.getByLabelText('Dismiss', { includeHiddenElements: true }).props
        .style,
    );
    expect(scrim.left).toBe(0);
    expect(scrim.right).toBe(0);
    expect(panel.marginHorizontal).toBe(-StyleSheet.hairlineWidth);
    // The content stays where it was: the padding takes the overhang back.
    expect(panel.paddingHorizontal + panel.marginHorizontal).toBe(16);
  });

  it('should raise the sheet on the muted surface with a border top edge in dark (P6)', async () => {
    await render(
      <ThemeProvider appearance="dark">
        <BottomSheet visible onDismiss={jest.fn()} title="Sort items by">
          <Text>Aisle</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    const sheet = screen.getByTestId('sheet-panel');
    const style = StyleSheet.flatten(sheet.props.style);
    expect(style.backgroundColor).toBe('#0f172a');
    expect(style.borderTopWidth).toBe(1);
    expect(style.borderColor).toBe('#1d283a');
    expect(style.borderTopLeftRadius).toBe(16);
  });

  it('should offer a close button when asked', async () => {
    const onDismiss = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider appearance="light">
        <BottomSheet visible onDismiss={onDismiss} title="Add item" showClose>
          <Text>Item</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    await user.press(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('Form presentation (navBar)', () => {
    it('should render Cancel, the title and the primary action', async () => {
      const onDismiss = jest.fn();
      const onAction = jest.fn();
      const user = userEvent.setup();
      await render(
        <ThemeProvider appearance="light">
          <BottomSheet
            visible
            onDismiss={onDismiss}
            title="Edit Netflix"
            navBar={{ actionLabel: 'Save', onAction }}
          >
            <Text>Status</Text>
          </BottomSheet>
        </ThemeProvider>,
      );
      expect(screen.getByRole('header', { name: 'Edit Netflix' })).toBeTruthy();
      await user.press(screen.getByRole('button', { name: 'Save' }));
      expect(onAction).toHaveBeenCalledTimes(1);
      await user.press(screen.getByRole('button', { name: 'Cancel' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should hold the action while it is disabled', async () => {
      const onAction = jest.fn();
      const user = userEvent.setup();
      await render(
        <ThemeProvider appearance="light">
          <BottomSheet
            visible
            onDismiss={jest.fn()}
            title="New subscription"
            navBar={{ actionLabel: 'Add', onAction, actionDisabled: true }}
          >
            <Text>Name</Text>
          </BottomSheet>
        </ThemeProvider>,
      );
      await user.press(screen.getByRole('button', { name: 'Add' }));
      expect(onAction).not.toHaveBeenCalled();
    });
  });
});
