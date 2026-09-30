import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
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

  it('announces its title as a header', async () => {
    await render(
      <TestWrapper>
        <EmptyState icon="tasks" title="No tasks yet" />
      </TestWrapper>,
    );
    expect(
      screen.getByRole('header', { name: 'No tasks yet' }),
    ).toBeOnTheScreen();
  });
  it('offers its action as a secondary button when asked', async () => {
    const onAction = jest.fn();
    await render(
      <TestWrapper>
        <EmptyState
          icon="check"
          tone="success"
          title="All clear"
          description="Nothing open. 4 Tasks done this week."
          actionLabel="Show done"
          actionVariant="secondary"
          onAction={onAction}
        />
      </TestWrapper>,
    );
    const button = screen.getByRole('button', { name: 'Show done' });
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(
      lightTheme.colors.secondary,
    );
    await userEvent.setup().press(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
