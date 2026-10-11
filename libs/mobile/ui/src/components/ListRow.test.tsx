import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  type View,
} from 'react-native';
import { ThemeProvider } from '../useTheme';
import { COMFORTABLE_ROW_HEIGHT } from '../metrics';
import { keyboardFocusedView } from '../hooks/focusReturn';
import { lightTheme } from '../theme';
import { ListSection } from './ListSection';
import { ListRow } from './ListRow';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('ListRow Component', () => {
  describe('Rendering basic content', () => {
    it('should render title and subtitle', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Task 1" subtitle="Subtask A" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Task 1')).toBeOnTheScreen();
      expect(await screen.findByText('Subtask A')).toBeOnTheScreen();
    });

    it('should render title without subtitle', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Task Only" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Task Only')).toBeOnTheScreen();
    });
  });

  describe('Unconfirmed state', () => {
    it('should render unconfirmed badge with default label', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Pending" state="unconfirmed" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Saving…')).toBeOnTheScreen();
    });

    it('should render unconfirmed badge with custom label', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Pending"
            state="unconfirmed"
            unconfirmedLabel="Syncing"
          />
        </TestWrapper>,
      );
      expect(await screen.findByText('Syncing')).toBeOnTheScreen();
    });

    it('should not render unconfirmed badge in normal state', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Task" state="normal" />
        </TestWrapper>,
      );
      expect(screen.queryByText('Saving…')).not.toBeOnTheScreen();
    });

    // Android rebuilds a row's content description only when the state it is
    // handed still carries a `busy` key, so `busy` left out once the save
    // lands is "…, busy" read for as long as the row stays mounted (#1077).
    it('says it is no longer busy once the save lands, rather than leaving busy out', async () => {
      const row = (state: 'unconfirmed' | 'normal' | 'reverted') => (
        <TestWrapper>
          <ListRow title="Oat milk" state={state} onPress={jest.fn()} />
        </TestWrapper>
      );
      const { rerender } = await render(row('unconfirmed'));
      expect(screen.getByRole('button').props.accessibilityState.busy).toBe(
        true,
      );
      await rerender(row('normal'));
      expect(screen.getByRole('button').props.accessibilityState.busy).toBe(
        false,
      );
      await rerender(row('reverted'));
      expect(screen.getByRole('button').props.accessibilityState.busy).toBe(
        false,
      );
    });

    it('carries busy as a boolean on a row that was never saving', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Task" onPress={jest.fn()} />
        </TestWrapper>,
      );
      expect(screen.getByRole('button').props.accessibilityState.busy).toBe(
        false,
      );
    });
  });

  describe('Reverted state', () => {
    it('should render reason in reverted state', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Task"
            state="reverted"
            revertedReason="Task already completed"
          />
        </TestWrapper>,
      );
      expect(
        await screen.findByText('Task already completed'),
      ).toBeOnTheScreen();
    });

    it('should not render reason when reverted state without reason', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Task" state="reverted" />
        </TestWrapper>,
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('should render Retry button when onRetry is provided', async () => {
      const onRetry = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Task"
            state="reverted"
            revertedReason="Error occurred"
            onRetry={onRetry}
          />
        </TestWrapper>,
      );
      const retryButton = await screen.findByLabelText('Retry');
      expect(retryButton).toBeTruthy();
    });

    it('should call onRetry when Retry button is pressed', async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <ListRow
            title="Task"
            state="reverted"
            revertedReason="Error"
            onRetry={onRetry}
          />
        </TestWrapper>,
      );
      const retryButton = await screen.findByLabelText('Retry');
      await user.press(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    it('should not render Retry button when onRetry is not provided', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Task" state="reverted" revertedReason="Error" />
        </TestWrapper>,
      );
      expect(screen.queryByLabelText('Retry')).toBeNull();
    });
  });

  describe('Swipe actions and accessibility actions', () => {
    it('should expose left and right actions as accessibility actions', async () => {
      const leftPress = jest.fn();
      const rightPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            leftActions={[
              {
                id: 'archive',
                label: 'Archive',
                icon: 'info',
                onPress: leftPress,
              },
            ]}
            rightActions={[
              {
                id: 'del',
                label: 'Delete',
                icon: 'error',
                onPress: rightPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      expect(row.props.accessibilityActions).toEqual([
        { name: 'archive', label: 'Archive' },
        { name: 'del', label: 'Delete' },
      ]);
    });

    it('should call left action onPress when accessibility action is fired', async () => {
      const leftPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            leftActions={[
              {
                id: 'archive',
                label: 'Archive',
                icon: 'info',
                onPress: leftPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      fireEvent(row, 'accessibilityAction', {
        nativeEvent: { actionName: 'archive' },
      });
      expect(leftPress).toHaveBeenCalledTimes(1);
    });

    it('should call right action onPress when accessibility action is fired', async () => {
      const rightPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            rightActions={[
              {
                id: 'del',
                label: 'Delete',
                icon: 'error',
                onPress: rightPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      fireEvent(row, 'accessibilityAction', {
        nativeEvent: { actionName: 'del' },
      });
      expect(rightPress).toHaveBeenCalledTimes(1);
    });

    it('should call nothing for unknown accessibility action name', async () => {
      const leftPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            leftActions={[
              {
                id: 'archive',
                label: 'Archive',
                icon: 'info',
                onPress: leftPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      fireEvent(row, 'accessibilityAction', {
        nativeEvent: { actionName: 'unknown' },
      });
      expect(leftPress).not.toHaveBeenCalled();
    });
  });

  describe('Checkbox and accessibility roles', () => {
    it('announces row as checkbox when checked prop is true', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Milk" checked={true} onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('checkbox');
      expect(row.props.accessibilityState.checked).toBe(true);
    });

    it('announces row as checkbox when checked prop is false', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Milk" checked={false} onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('checkbox');
      expect(row.props.accessibilityState.checked).toBe(false);
    });

    it('announces row as button when checked is not given but onPress is', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Milk" onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      expect(row.props.accessibilityState?.checked).toBeUndefined();
    });
  });

  describe('toggle', () => {
    it('announces the row as a switch in its state, and presses flip it', async () => {
      const onPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Keep screen awake on a trip"
            toggle={{ value: true }}
            onPress={onPress}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('switch');
      expect(row.props.accessibilityState.checked).toBe(true);
      expect(row.props.accessibilityState.disabled).toBe(false);
      await userEvent.setup().press(row);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('announces a switch that cannot be flipped as disabled', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Biometric Unlock"
            toggle={{ value: false, disabled: true }}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('switch');
      expect(row.props.accessibilityState).toMatchObject({
        checked: false,
        disabled: true,
      });
    });
  });

  describe('accessibilityLabel', () => {
    it('uses accessibilityLabel when provided', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            subtitle="2 liters"
            accessibilityLabel="Milk, 2 liters, amount button"
          />
        </TestWrapper>,
      );
      expect(
        await screen.findByLabelText('Milk, 2 liters, amount button'),
      ).toBeOnTheScreen();
    });

    it('overrides title and subtitle label with accessibilityLabel', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            subtitle="2 liters"
            accessibilityLabel="Custom label"
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button');
      expect(row.props.accessibilityLabel).toBe('Custom label');
    });
  });

  describe('innerActions', () => {
    it('adds innerActions to accessibilityActions', async () => {
      const amountPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            innerActions={[
              {
                id: 'set-amount',
                label: 'Set amount',
                onPress: amountPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      expect(row.props.accessibilityActions).toContainEqual({
        name: 'set-amount',
        label: 'Set amount',
      });
    });

    it('calls innerAction onPress when accessibility action is fired', async () => {
      const amountPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            innerActions={[
              {
                id: 'set-amount',
                label: 'Set amount',
                onPress: amountPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      fireEvent(row, 'accessibilityAction', {
        nativeEvent: { actionName: 'set-amount' },
      });
      expect(amountPress).toHaveBeenCalledTimes(1);
    });

    it('combines left, right, and innerActions in accessibilityActions', async () => {
      const leftPress = jest.fn();
      const rightPress = jest.fn();
      const innerPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            leftActions={[
              {
                id: 'left',
                label: 'Left',
                icon: 'info',
                onPress: leftPress,
              },
            ]}
            rightActions={[
              {
                id: 'right',
                label: 'Right',
                icon: 'error',
                onPress: rightPress,
              },
            ]}
            innerActions={[
              {
                id: 'inner',
                label: 'Inner',
                onPress: innerPress,
              },
            ]}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Milk' });
      expect(row.props.accessibilityActions).toEqual([
        { name: 'left', label: 'Left' },
        { name: 'right', label: 'Right' },
        { name: 'inner', label: 'Inner' },
      ]);
    });

    it('draws nothing for innerActions (no visible label)', async () => {
      const innerPress = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            innerActions={[
              {
                id: 'set-amount',
                label: 'Set amount',
                onPress: innerPress,
              },
            ]}
          />
        </TestWrapper>,
      );
      // The action label should not appear as a rendered element (only in accessibility metadata)
      expect(screen.queryByText('Set amount')).not.toBeOnTheScreen();
    });
  });

  describe('retryLabel', () => {
    it('uses default "Retry" label when retryLabel is not provided', async () => {
      const onRetry = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Task"
            state="reverted"
            revertedReason="Error occurred"
            onRetry={onRetry}
          />
        </TestWrapper>,
      );
      const retryButton = await screen.findByLabelText('Retry');
      expect(retryButton).toBeOnTheScreen();
    });

    it('uses custom retryLabel when provided', async () => {
      const onRetry = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Task"
            state="reverted"
            revertedReason="Conflict: reload to see the other device's copy"
            onRetry={onRetry}
            retryLabel="Reload"
          />
        </TestWrapper>,
      );
      const reloadButton = await screen.findByLabelText('Reload');
      expect(reloadButton).toBeOnTheScreen();
    });

    it('calls onRetry with custom retryLabel', async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <ListRow
            title="Task"
            state="reverted"
            revertedReason="Error"
            onRetry={onRetry}
            retryLabel="Reload"
          />
        </TestWrapper>,
      );
      const reloadButton = await screen.findByLabelText('Reload');
      await user.press(reloadButton);
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('size prop', () => {
    it('renders a single-line row at the 56pt minimum height', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Standard row" onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Standard row' });
      const flatStyle = StyleSheet.flatten(row.props.style);
      expect(flatStyle.minHeight).toBe(56);
    });

    it('renders a row with a subtitle at the 64pt minimum height', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Two lines" subtitle="Due Fri" onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Two lines, Due Fri' });
      expect(StyleSheet.flatten(row.props.style).minHeight).toBe(64);
    });

    it('renders with COMFORTABLE_ROW_HEIGHT minHeight when size is "comfortable"', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Comfortable row"
            size="comfortable"
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Comfortable row' });
      const flatStyle = StyleSheet.flatten(row.props.style);
      expect(flatStyle.minHeight).toBe(COMFORTABLE_ROW_HEIGHT);
    });
  });

  describe('onLongPress', () => {
    it('calls onLongPress when the row is long-pressed', async () => {
      const onLongPress = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <ListRow
            title="Weekly shop"
            onPress={jest.fn()}
            onLongPress={onLongPress}
          />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Weekly shop' });
      await user.longPress(row);
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('does not require onLongPress to be set', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Weekly shop" onPress={jest.fn()} />
        </TestWrapper>,
      );
      expect(
        screen.getByRole('button', { name: 'Weekly shop' }),
      ).toBeOnTheScreen();
    });
  });

  describe('design states', () => {
    it('keeps an unconfirmed row at full opacity with the note in the warning colour', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Oat milk" state="unconfirmed" onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Oat milk' });
      expect(StyleSheet.flatten(row.props.style).opacity).toBeUndefined();
      expect(
        StyleSheet.flatten(screen.getByText('Saving…').props.style).color,
      ).toBe(lightTheme.colors.warning);
    });

    it('draws a checked title muted with a strikethrough', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Oat milk" checked onPress={jest.fn()} />
        </TestWrapper>,
      );
      const struck = screen
        .getAllByText('Oat milk', { includeHiddenElements: true })
        .map((node) => StyleSheet.flatten(node.props.style))
        .find((style) => style.textDecorationLine === 'line-through');
      expect(struck?.color).toBe(lightTheme.colors.mutedForeground);
    });

    it('mutes a checked title without striking it when strikeChecked is false', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Medibank"
            checked
            strikeChecked={false}
            onPress={jest.fn()}
          />
        </TestWrapper>,
      );
      const styles = screen
        .getAllByText('Medibank', { includeHiddenElements: true })
        .map((node) => StyleSheet.flatten(node.props.style));
      expect(
        styles.some((style) => style.textDecorationLine === 'line-through'),
      ).toBe(false);
      expect(
        styles.some(
          (style) => style.color === lightTheme.colors.mutedForeground,
        ),
      ).toBe(true);
      expect(
        screen.getByRole('checkbox', { name: 'Medibank' }).props
          .accessibilityState.checked,
      ).toBe(true);
    });

    it('dims a disabled row, takes it off the focus path, and ignores presses', async () => {
      const onPress = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <ListRow title="Passport" onPress={onPress} disabled />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Passport' });
      expect(row.props.focusable).toBe(false);
      await user.press(row);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('draws the reverted note with the reason and a Reload action for a conflict', async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <ListRow
            title="Oat milk"
            state="reverted"
            revertedReason="Changed on another device. Reload to see the latest."
            retryLabel="Reload"
            onRetry={onRetry}
          />
        </TestWrapper>,
      );
      expect(
        screen.getByText(
          'Changed on another device. Reload to see the latest.',
        ),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Reload' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('fills a primary swipe action with the primary role', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Renew passport"
            leftActions={[
              {
                id: 'done',
                label: 'Done',
                icon: 'check',
                tone: 'primary',
                onPress: jest.fn(),
              },
            ]}
          />
        </TestWrapper>,
      );
      // Behind a closed row, so not an accessibility element until swiped.
      const action = screen.getByLabelText('Done', {
        includeHiddenElements: true,
      });
      const style = StyleSheet.flatten(action.props.style);
      expect(style.backgroundColor).toBe(lightTheme.colors.primary);
      expect(style.width).toBe(88);
    });
  });

  describe('dividers inside a ListSection', () => {
    it('draws a divider under every row but the last', async () => {
      await render(
        <TestWrapper>
          <ListSection title="To buy" count={3}>
            <ListRow title="Oat milk" />
            <ListRow title="Sourdough loaf" />
            <ListRow title="Free-range eggs" />
          </ListSection>
        </TestWrapper>,
      );
      expect(
        screen.getAllByTestId('list-row-divider', {
          includeHiddenElements: true,
        }),
      ).toHaveLength(2);
    });

    it('draws no divider for a row outside a section', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Passport" />
        </TestWrapper>,
      );
      expect(
        screen.queryByTestId('list-row-divider', {
          includeHiddenElements: true,
        }),
      ).toBeNull();
    });
  });

  describe('tick sequence', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('calls onTickSettled once the dwell after a tick has passed', async () => {
      const onTickSettled = jest.fn();
      const { rerender } = await render(
        <TestWrapper>
          <ListRow
            title="Oat milk"
            checked={false}
            onTickSettled={onTickSettled}
          />
        </TestWrapper>,
      );
      await rerender(
        <TestWrapper>
          <ListRow title="Oat milk" checked onTickSettled={onTickSettled} />
        </TestWrapper>,
      );
      await act(() => jest.advanceTimersByTime(500));
      expect(onTickSettled).not.toHaveBeenCalled();
      await act(() => jest.advanceTimersByTime(300));
      expect(onTickSettled).toHaveBeenCalledTimes(1);
    });

    it('cancels the move when the row is unticked during the dwell', async () => {
      const onTickSettled = jest.fn();
      const row = (checked: boolean) => (
        <TestWrapper>
          <ListRow
            title="Oat milk"
            checked={checked}
            onTickSettled={onTickSettled}
          />
        </TestWrapper>
      );
      const { rerender } = await render(row(false));
      await rerender(row(true));
      await act(() => jest.advanceTimersByTime(300));
      await rerender(row(false));
      await act(() => jest.advanceTimersByTime(2000));
      expect(onTickSettled).not.toHaveBeenCalled();
    });

    it('does not settle a row that mounts already checked', async () => {
      const onTickSettled = jest.fn();
      await render(
        <TestWrapper>
          <ListRow title="Oat milk" checked onTickSettled={onTickSettled} />
        </TestWrapper>,
      );
      await act(() => jest.advanceTimersByTime(2000));
      expect(onTickSettled).not.toHaveBeenCalled();
    });
  });

  describe('revert haptic', () => {
    it('fires the warning haptic when an unconfirmed row is reverted', async () => {
      const trigger = jest.requireMock<{ default: { trigger: jest.Mock } }>(
        'react-native-haptic-feedback',
      ).default.trigger;
      trigger.mockClear();
      const row = (state: 'unconfirmed' | 'reverted') => (
        <TestWrapper>
          <ListRow title="Oat milk" state={state} revertedReason="Not saved." />
        </TestWrapper>
      );
      const { rerender } = await render(row('unconfirmed'));
      expect(trigger).not.toHaveBeenCalled();
      await rerender(row('reverted'));
      expect(trigger).toHaveBeenCalledWith(
        'notificationWarning',
        expect.any(Object),
      );
    });
  });

  /**
   * What a hardware keyboard may stop on. Android puts a view in the Tab
   * order when it is `accessible` or `focusable`. A row that does nothing must
   * carry neither. A swipe action is the exception: it is a stop even behind a
   * closed row, because a hardware keyboard cannot swipe. Taking its focus
   * opens the row to show it, and losing focus shuts the row again (#1027).
   * Until then its panel is hidden from a screen reader.
   *
   * The swipe that reveals an action is not performed here: its callbacks are
   * worklets, and the Reanimated double this project runs under does not
   * dispatch a gesture to a worklet. Focus is fired at the rendered action
   * instead, which is the event a hardware keyboard sends.
   */
  describe('keyboard stops', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    const deleteAction = () =>
      screen.getByLabelText('Delete', { includeHiddenElements: true });
    // The Reanimated double keeps a shared value only for one render, so the
    // sheet's offset cannot be read back from the tree. Where the row opens
    // to is what `settleTo` hands `withSpring`, so that is what is spied.
    const reanimated = jest.requireMock<{
      withSpring: (...args: unknown[]) => unknown;
    }>('react-native-reanimated');
    const row = (
      <TestWrapper>
        <ListRow
          title="Milk"
          onPress={jest.fn()}
          rightActions={[
            { id: 'del', label: 'Delete', icon: 'trash', onPress: jest.fn() },
          ]}
        />
      </TestWrapper>
    );

    it('keeps a swipe action behind a closed row a keyboard stop, hidden from a screen reader until it opens', async () => {
      await render(row);

      expect(deleteAction().props.accessible).toBe(true);
      expect(deleteAction().props.focusable).toBe(true);
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
      // The row still offers it.
      expect(
        screen.getByRole('button', { name: 'Milk' }).props.accessibilityActions,
      ).toEqual([{ name: 'del', label: 'Delete' }]);
    });

    it('reveals a focused swipe action to a screen reader', async () => {
      await render(row);

      await fireEvent(deleteAction(), 'focus');

      expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
    });

    it('shuts the row again once focus has left its action', async () => {
      await render(row);
      await fireEvent(deleteAction(), 'focus');

      await fireEvent(deleteAction(), 'blur');
      // The shut waits for the zero-delay check, so a focus arriving in the
      // meantime finds the row still open.
      expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
      await act(() => jest.advanceTimersByTime(0));

      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });

    it('opens the row to the side of the action that took focus, and shuts it on blur', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            onPress={jest.fn()}
            leftActions={[
              { id: 'done', label: 'Done', icon: 'check', onPress: jest.fn() },
            ]}
            rightActions={[
              { id: 'del', label: 'Delete', icon: 'trash', onPress: jest.fn() },
            ]}
          />
        </TestWrapper>,
      );
      const done = () =>
        screen.getByLabelText('Done', { includeHiddenElements: true });

      const spring = jest.spyOn(reanimated, 'withSpring');

      await fireEvent(done(), 'focus');
      expect(spring).toHaveBeenLastCalledWith(
        88,
        expect.anything(),
        expect.any(Function),
      );
      await fireEvent(done(), 'blur');
      await act(() => jest.advanceTimersByTime(0));
      expect(spring).toHaveBeenLastCalledWith(
        0,
        expect.anything(),
        expect.any(Function),
      );

      await fireEvent(deleteAction(), 'focus');
      expect(spring).toHaveBeenLastCalledWith(
        -88,
        expect.anything(),
        expect.any(Function),
      );
      await fireEvent(deleteAction(), 'blur');
      await act(() => jest.advanceTimersByTime(0));
      expect(spring).toHaveBeenLastCalledWith(
        0,
        expect.anything(),
        expect.any(Function),
      );
    });

    it('opens the row with no spring under Reduce Motion, and shuts it on blur once the check runs', async () => {
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(true);
      const spring = jest.spyOn(reanimated, 'withSpring');
      await render(row);
      // The hook reads the setting in an effect, after its promise settles.
      await act(() => Promise.resolve());

      await fireEvent(deleteAction(), 'focus');
      expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
      // Not spring-less by accident: with motion on, focus starts one.
      expect(spring).not.toHaveBeenCalled();

      await fireEvent(deleteAction(), 'blur');
      await act(() => jest.advanceTimersByTime(0));
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
      expect(spring).not.toHaveBeenCalled();
    });

    it('keeps the row open while focus moves from one of its actions to another', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            onPress={jest.fn()}
            rightActions={[
              { id: 'del', label: 'Delete', icon: 'trash', onPress: jest.fn() },
              {
                id: 'archive',
                label: 'Archive',
                icon: 'info',
                onPress: jest.fn(),
              },
            ]}
          />
        </TestWrapper>,
      );
      await fireEvent(deleteAction(), 'focus');
      await fireEvent(deleteAction(), 'blur');
      await fireEvent(
        screen.getByLabelText('Archive', { includeHiddenElements: true }),
        'focus',
      );
      await act(() => jest.advanceTimersByTime(0));

      expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Archive' })).toBeOnTheScreen();
    });

    it('draws a focused swipe action ring in its tile text colour, and none once unfocused', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Renew passport"
            leftActions={[
              {
                id: 'done',
                label: 'Done',
                icon: 'check',
                tone: 'primary',
                onPress: jest.fn(),
              },
            ]}
          />
        </TestWrapper>,
      );
      const done = () =>
        screen.getByLabelText('Done', { includeHiddenElements: true });
      expect(
        StyleSheet.flatten(done().props.style).outlineColor,
      ).toBeUndefined();

      await fireEvent(done(), 'focus');
      const ring = StyleSheet.flatten(done().props.style);
      expect(ring.outlineWidth).toBe(2);
      expect(ring.outlineColor).toBe(lightTheme.colors.primaryForeground);

      await fireEvent(done(), 'blur');
      expect(
        StyleSheet.flatten(done().props.style).outlineColor,
      ).toBeUndefined();
    });

    it('reports the row as the keyboard-focused view while one of its actions has focus', async () => {
      const rowRef = React.createRef<React.ComponentRef<typeof View>>();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            onPress={jest.fn()}
            ref={rowRef}
            rightActions={[
              { id: 'del', label: 'Delete', icon: 'trash', onPress: jest.fn() },
            ]}
          />
        </TestWrapper>,
      );
      expect(rowRef.current).not.toBeNull();

      await fireEvent(deleteAction(), 'focus');
      expect(keyboardFocusedView()).toBe(rowRef.current);

      await fireEvent(deleteAction(), 'blur');
      expect(keyboardFocusedView()).toBeNull();
    });

    it('hands the row view to a function ref, which keyboard focus on an action then reports', async () => {
      const rowRef = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            onPress={jest.fn()}
            ref={rowRef}
            rightActions={[
              { id: 'del', label: 'Delete', icon: 'trash', onPress: jest.fn() },
            ]}
          />
        </TestWrapper>,
      );
      const view: unknown = rowRef.mock.calls[0]?.[0];
      expect(view).toBeTruthy();

      await fireEvent(deleteAction(), 'focus');
      expect(keyboardFocusedView()).toBe(view);
    });

    it('presses a focused swipe action through its own onPress', async () => {
      const onDelete = jest.fn();
      await render(
        <TestWrapper>
          <ListRow
            title="Milk"
            onPress={jest.fn()}
            rightActions={[
              { id: 'del', label: 'Delete', icon: 'trash', onPress: onDelete },
            ]}
          />
        </TestWrapper>,
      );
      await fireEvent(deleteAction(), 'focus');

      await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('gives a disabled row no swipe actions, so there is no hidden stop to reach', async () => {
      await render(
        <TestWrapper>
          <ListRow
            title="Passport"
            onPress={jest.fn()}
            disabled
            rightActions={[
              { id: 'del', label: 'Delete', icon: 'trash', onPress: jest.fn() },
            ]}
          />
        </TestWrapper>,
      );

      expect(
        screen.queryByLabelText('Delete', { includeHiddenElements: true }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Passport' }).props
          .accessibilityActions,
      ).toEqual([]);
    });

    it('keeps a pressable row a keyboard stop', async () => {
      await render(row);
      const milk = screen.getByLabelText('Milk');
      expect(milk.props.accessible).toBe(true);
      expect(milk.props.focusable).toBe(true);
    });

    it('reads a row that does nothing as one element that is no keyboard stop on Android', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(
        <TestWrapper>
          <ListRow title="Version" value="1.0 (1)" />
        </TestWrapper>,
      );
      const version = screen.getByLabelText('Version');
      expect(version.props.accessible).toBe(false);
      expect(version.props.focusable).toBe(false);
      expect(version.props.screenReaderFocusable).toBe(true);
    });

    it('keeps a row that does nothing an accessibility element on iOS', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Version" value="1.0 (1)" />
        </TestWrapper>,
      );
      expect(screen.getByLabelText('Version').props.accessible).toBe(true);
    });
  });
});
