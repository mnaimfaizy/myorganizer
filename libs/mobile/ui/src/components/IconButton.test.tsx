import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { IconButton } from './IconButton';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('IconButton Component', () => {
  it('should render with button role and the given accessibility label', async () => {
    await render(
      <TestWrapper>
        <IconButton
          icon="plus"
          accessibilityLabel="Add to list"
          onPress={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(
      screen.getByRole('button', { name: 'Add to list' }),
    ).toBeOnTheScreen();
  });

  it('should call onPress when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <IconButton
          icon="more"
          accessibilityLabel="List menu"
          onPress={onPress}
        />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'List menu' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should report disabled state through accessibility and not call onPress', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <IconButton
          icon="plus"
          accessibilityLabel="Add to list"
          onPress={onPress}
          disabled
        />
      </TestWrapper>,
    );
    const button = screen.getByRole('button', { name: 'Add to list' });
    expect(button.props.accessibilityState?.disabled).toBe(true);
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
