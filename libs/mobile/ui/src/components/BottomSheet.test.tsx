import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
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

  it('should raise the sheet on the muted surface with a border top edge in dark (P6)', async () => {
    await render(
      <ThemeProvider appearance="dark">
        <BottomSheet visible onDismiss={jest.fn()} title="Sort items by">
          <Text>Aisle</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    const sheet = screen.getByLabelText('Sort items by');
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
