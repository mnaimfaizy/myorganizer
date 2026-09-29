import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { COMFORTABLE_ROW_HEIGHT, MIN_TOUCH_TARGET } from '../metrics';
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
      expect(await screen.findByText('Unconfirmed')).toBeOnTheScreen();
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
      expect(screen.queryByText('Unconfirmed')).not.toBeOnTheScreen();
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
    it('renders with MIN_TOUCH_TARGET minHeight when size is not specified', async () => {
      await render(
        <TestWrapper>
          <ListRow title="Standard row" onPress={jest.fn()} />
        </TestWrapper>,
      );
      const row = screen.getByRole('button', { name: 'Standard row' });
      const flatStyle = StyleSheet.flatten(row.props.style);
      expect(flatStyle.minHeight).toBe(MIN_TOUCH_TARGET);
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
});
