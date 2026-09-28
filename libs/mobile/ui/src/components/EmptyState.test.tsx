import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { EmptyState } from './EmptyState';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('EmptyState Component', () => {
  it('should render title', async () => {
    await render(
      <TestWrapper>
        <EmptyState title="No tasks" />
      </TestWrapper>,
    );
    expect(await screen.findByText('No tasks')).toBeOnTheScreen();
  });

  it('should render description when provided', async () => {
    await render(
      <TestWrapper>
        <EmptyState title="No tasks" description="Get started" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Get started')).toBeOnTheScreen();
  });

  it('should render action button when label and handler provided', async () => {
    await render(
      <TestWrapper>
        <EmptyState
          title="No tasks"
          actionLabel="Create"
          onAction={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(await screen.findByLabelText('Create')).toBeOnTheScreen();
  });

  it('should call onAction when action button is pressed', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <EmptyState title="No tasks" actionLabel="Create" onAction={onAction} />
      </TestWrapper>,
    );
    const button = await screen.findByLabelText('Create');
    await user.press(button);
    expect(onAction).toHaveBeenCalled();
  });

  it('should not render action when only label provided', async () => {
    await render(
      <TestWrapper>
        <EmptyState title="No tasks" actionLabel="Create" />
      </TestWrapper>,
    );
    expect(screen.queryByLabelText('Create')).toBeNull();
  });
});
