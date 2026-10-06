import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { InlineNotice } from './InlineNotice';
import { ListRow } from './ListRow';
import { LockAction } from './LockAction';
import { MenuSheet } from './MenuSheet';
import { Switch } from './Switch';
import { TextField } from './TextField';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

const outline = (label: string) => {
  const style = StyleSheet.flatten(
    screen.getByLabelText(label, { includeHiddenElements: true }).props.style,
  );
  return {
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
  };
};

const NO_RING = { width: undefined, color: undefined, offset: undefined };
const OUTSIDE = { width: 2, color: lightTheme.colors.focus, offset: 2 };
const INSET = { width: 2, color: lightTheme.colors.focus, offset: -2 };

/**
 * The ring through a real `Pressable`, not through the hook alone: the focus
 * event is fired at the rendered control, so each case passes only if
 * `Pressable` forwards it to the handler `useFocusRing` returned. React
 * Native 0.79's did not, which is how every control here was wired to a ring
 * that never drew.
 */
describe('P3 focus ring on a focused control', () => {
  it.each([
    [
      'Button',
      'Log out',
      OUTSIDE,
      <Button label="Log out" onPress={jest.fn()} />,
    ],
    ['LockAction', 'Lock vault', OUTSIDE, <LockAction onPress={jest.fn()} />],
    [
      'InlineNotice action',
      'Retry',
      OUTSIDE,
      <InlineNotice
        message="Offline"
        actionLabel="Retry"
        onAction={jest.fn()}
      />,
    ],
    [
      'MenuSheet row',
      'Rename',
      INSET,
      <MenuSheet
        visible
        onDismiss={jest.fn()}
        items={[{ id: 'rename', label: 'Rename', onPress: jest.fn() }]}
      />,
    ],
    [
      'BottomSheet scrim',
      'Dismiss',
      INSET,
      <BottomSheet visible onDismiss={jest.fn()} title="Sort" showClose />,
    ],
    [
      'BottomSheet close',
      'Close',
      OUTSIDE,
      <BottomSheet visible onDismiss={jest.fn()} title="Sort" showClose />,
    ],
    [
      'BottomSheet nav action',
      'Save',
      OUTSIDE,
      <BottomSheet
        visible
        onDismiss={jest.fn()}
        title="New item"
        navBar={{ actionLabel: 'Save', onAction: jest.fn() }}
      />,
    ],
    [
      'ListRow swipe action',
      'Delete',
      INSET,
      <ListRow
        title="Milk"
        onPress={jest.fn()}
        rightActions={[
          { id: 'del', label: 'Delete', icon: 'error', onPress: jest.fn() },
        ]}
      />,
    ],
    [
      'TextField accessory',
      'Clear name',
      INSET,
      <TextField
        label="Name"
        value="Milk"
        onChangeText={jest.fn()}
        onClear={jest.fn()}
      />,
    ],
  ])(
    '%s draws it on focus and clears it on blur',
    async (_, label, ring, ui) => {
      await render(<TestWrapper>{ui}</TestWrapper>);
      expect(outline(label)).toEqual(NO_RING);

      await fireEvent(
        screen.getByLabelText(label, { includeHiddenElements: true }),
        'focus',
      );
      expect(outline(label)).toEqual(ring);

      await fireEvent(
        screen.getByLabelText(label, { includeHiddenElements: true }),
        'blur',
      );
      expect(outline(label)).toEqual(NO_RING);
    },
  );

  it('Switch draws it around the platform switch, which reports the focus', async () => {
    await render(
      <TestWrapper>
        <Switch label="Biometric Unlock" value onValueChange={jest.fn()} />
      </TestWrapper>,
    );
    const ring = () => {
      const style = StyleSheet.flatten(
        screen.getByRole('switch').parent?.props.style,
      );
      return {
        width: style.outlineWidth,
        color: style.outlineColor,
        offset: style.outlineOffset,
      };
    };
    expect(ring()).toEqual(NO_RING);

    await fireEvent(screen.getByRole('switch'), 'focus');
    expect(ring()).toEqual(OUTSIDE);

    await fireEvent(screen.getByRole('switch'), 'blur');
    expect(ring()).toEqual(NO_RING);
  });
});
