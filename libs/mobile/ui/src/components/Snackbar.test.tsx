import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

  it('should call onDismiss after default duration', async () => {
    const onDismiss = jest.fn();
    await render(
      <TestWrapper>
        <Snackbar visible={true} message="Saved" onDismiss={onDismiss} />
      </TestWrapper>,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalled();
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
