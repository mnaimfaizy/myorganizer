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
});

/**
 * A sheet is a window of its own on Android, and the screen behind it keeps
 * its focused control without that control ever being sent a blur. So these
 * cases never fire one: the ring has to go because the sheet is up.
 */
describe('P3 focus ring behind an open sheet', () => {
  const Screen = ({ sheet }: { sheet: boolean }) => (
    <TestWrapper>
      <LockAction onPress={jest.fn()} />
      <MenuSheet
        visible={sheet}
        onDismiss={jest.fn()}
        title="Auto-lock"
        items={[{ id: 'now', label: 'Immediately', onPress: jest.fn() }]}
      />
    </TestWrapper>
  );

  it('is not drawn on a control that still has focus, and returns when the sheet closes', async () => {
    const view = await render(<Screen sheet={false} />);
    await fireEvent(screen.getByLabelText('Lock vault'), 'focus');
    expect(outline('Lock vault')).toEqual(OUTSIDE);

    await view.rerender(<Screen sheet />);
    expect(outline('Lock vault')).toEqual(NO_RING);

    await view.rerender(<Screen sheet={false} />);
    expect(outline('Lock vault')).toEqual(OUTSIDE);
  });

  it('is not drawn on a control that takes focus while the sheet is up', async () => {
    await render(<Screen sheet />);
    await fireEvent(
      screen.getByLabelText('Lock vault', { includeHiddenElements: true }),
      'focus',
    );
    await fireEvent(screen.getByLabelText('Immediately'), 'focus');

    expect(outline('Lock vault')).toEqual(NO_RING);
    expect(outline('Immediately')).toEqual(INSET);
  });

  it('is drawn in the sheet in front when one sheet is open inside another', async () => {
    await render(
      <TestWrapper>
        <BottomSheet
          visible
          onDismiss={jest.fn()}
          title="Edit"
          navBar={{ actionLabel: 'Save', onAction: jest.fn() }}
        >
          <MenuSheet
            visible
            onDismiss={jest.fn()}
            items={[{ id: 'rename', label: 'Rename', onPress: jest.fn() }]}
          />
        </BottomSheet>
      </TestWrapper>,
    );
    await fireEvent(
      screen.getByLabelText('Save', { includeHiddenElements: true }),
      'focus',
    );
    await fireEvent(screen.getByLabelText('Rename'), 'focus');

    expect(outline('Save')).toEqual(NO_RING);
    expect(outline('Rename')).toEqual(INSET);
  });
});
