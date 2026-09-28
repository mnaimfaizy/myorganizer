import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
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
});
