import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { ListSection } from './ListSection';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('ListSection Component', () => {
  it('should render section title', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Tasks')).toBeOnTheScreen();
  });

  it('should render meta text when provided', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" meta="5 items" />
      </TestWrapper>,
    );
    expect(await screen.findByText('5 items')).toBeOnTheScreen();
  });

  it('should render children in non-collapsible section', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={false}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    expect(await screen.findByText('Task item')).toBeOnTheScreen();
  });

  it('should render children by default in collapsible section', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    expect(await screen.findByText('Task item')).toBeOnTheScreen();
  });

  it('should start collapsed when defaultCollapsed is true', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true} defaultCollapsed={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    // Child should not be in the tree when collapsed
    expect(screen.queryByText('Task item')).not.toBeOnTheScreen();
  });

  it('should report expanded state when open', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    const header = screen.getByRole('button');
    expect(header.props?.accessibilityState?.expanded).toBe(true);
  });

  it('should report collapsed state when closed', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true} defaultCollapsed={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    const header = screen.getByRole('button');
    expect(header.props?.accessibilityState?.expanded).toBe(false);
  });

  it('should unmount children when collapsing (not just hide them)', async () => {
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    expect(await screen.findByText('Task item')).toBeOnTheScreen();
    const header = screen.getByRole('button');
    await user.press(header);
    // After collapsing, child should be unmounted (not just hidden)
    expect(screen.queryByText('Task item')).not.toBeOnTheScreen();
  });

  it('should mount children again when expanding', async () => {
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true} defaultCollapsed={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    expect(screen.queryByText('Task item')).not.toBeOnTheScreen();
    const header = screen.getByRole('button');
    await user.press(header);
    // After expanding, child should be rendered again
    expect(await screen.findByText('Task item')).toBeOnTheScreen();
  });

  it('should announce title as accessibility label', async () => {
    await render(
      <TestWrapper>
        <ListSection title="Tasks" collapsible={true}>
          <Text>Task item</Text>
        </ListSection>
      </TestWrapper>,
    );
    const header = screen.getByRole('button');
    expect(header.props?.accessibilityLabel).toBe('Tasks');
  });
});
