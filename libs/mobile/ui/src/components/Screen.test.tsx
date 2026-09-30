import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { Screen } from './Screen';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('Screen Component', () => {
  it('should render children', async () => {
    await render(
      <TestWrapper>
        <Screen>
          <Text>Screen content</Text>
        </Screen>
      </TestWrapper>,
    );
    expect(await screen.findByText('Screen content')).toBeOnTheScreen();
  });

  it('should render with and without padding', async () => {
    await render(
      <TestWrapper>
        <Screen>
          <Text>With padding</Text>
        </Screen>
        <Screen noPadding={true}>
          <Text>No padding</Text>
        </Screen>
      </TestWrapper>,
    );
    expect(await screen.findByText('With padding')).toBeOnTheScreen();
    expect(await screen.findByText('No padding')).toBeOnTheScreen();
  });

  it('should render with custom edges', async () => {
    await render(
      <TestWrapper>
        <Screen edges={['top', 'left', 'right']}>
          <Text>Custom edges</Text>
        </Screen>
      </TestWrapper>,
    );
    expect(await screen.findByText('Custom edges')).toBeOnTheScreen();
  });
});
