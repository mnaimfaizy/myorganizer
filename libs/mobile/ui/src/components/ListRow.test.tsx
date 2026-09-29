import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { COMFORTABLE_ROW_HEIGHT } from '../metrics';
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
      const action = screen.getByRole('button', { name: 'Done' });
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
});
