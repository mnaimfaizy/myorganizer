import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { Snackbar } from './Snackbar';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('Snackbar Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render nothing when not visible', async () => {
    await render(
      <TestWrapper>
        <Snackbar visible={false} message="Saved" onDismiss={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.queryByText('Saved')).not.toBeOnTheScreen();
  });

  it('should render message when visible', async () => {
    await render(
      <TestWrapper>
        <Snackbar visible={true} message="Saved" onDismiss={jest.fn()} />
      </TestWrapper>,
    );
    expect(await screen.findByText('Saved')).toBeOnTheScreen();
  });

  it('should call onDismiss after the default six seconds, and not before', async () => {
    const onDismiss = jest.fn();
    await render(
      <TestWrapper>
        <Snackbar visible={true} message="Saved" onDismiss={onDismiss} />
      </TestWrapper>,
    );
    jest.advanceTimersByTime(5999);
    expect(onDismiss).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should hold while a finger is on the action', async () => {
    const onDismiss = jest.fn();
    await render(
      <TestWrapper>
        <Snackbar
          visible={true}
          message="Task archived"
          actionLabel="Undo"
          onAction={jest.fn()}
          onDismiss={onDismiss}
        />
      </TestWrapper>,
    );
    await act(async () => {
      fireEvent(screen.getByRole('button', { name: 'Undo' }), 'pressIn');
    });
    jest.advanceTimersByTime(10000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should render the message once and the action once', async () => {
    await render(
      <TestWrapper>
        <Snackbar
          visible={true}
          message="Task archived"
          actionLabel="Undo"
          onAction={jest.fn()}
          onDismiss={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Task archived')).toHaveLength(1);
    expect(screen.getAllByText('Undo')).toHaveLength(1);
  });

  it('should call onDismiss after custom duration', async () => {
    const onDismiss = jest.fn();
    await render(
      <TestWrapper>
        <Snackbar
          visible={true}
          message="Saved"
          onDismiss={onDismiss}
          durationMs={3000}
        />
      </TestWrapper>,
    );
    jest.advanceTimersByTime(3000);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should render action button when label and handler provided', async () => {
    await render(
      <TestWrapper>
        <Snackbar
          visible={true}
          message="Saved"
          actionLabel="Undo"
          onAction={jest.fn()}
          onDismiss={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(await screen.findByLabelText('Undo')).toBeOnTheScreen();
  });

  it('should call onAction when action is pressed', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Snackbar
          visible={true}
          message="Saved"
          actionLabel="Undo"
          onAction={onAction}
          onDismiss={jest.fn()}
        />
      </TestWrapper>,
    );
    const button = await screen.findByLabelText('Undo');
    await user.press(button);
    expect(onAction).toHaveBeenCalled();
  });
});
