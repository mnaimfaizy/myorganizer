import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { Chip } from './Chip';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('Chip Component', () => {
  it('should fill a selected chip with primary, not brand', async () => {
    await render(
      <TestWrapper>
        <Chip label="Dairy" selected onPress={jest.fn()} />
      </TestWrapper>,
    );
    const chip = screen.getByRole('button', { name: 'Dairy' });
    const style = StyleSheet.flatten(chip.props.style);
    expect(style.backgroundColor).toBe('#0f172a');
    expect(style.borderRadius).toBe(8);
  });

  it('should edge an unselected chip in controlEdge', async () => {
    await render(
      <TestWrapper>
        <Chip label="Dairy" onPress={jest.fn()} />
      </TestWrapper>,
    );
    const chip = screen.getByRole('button', { name: 'Dairy' });
    expect(StyleSheet.flatten(chip.props.style).borderColor).toBe('#64748b');
  });

  it('should announce selection as checked when it is one of a set', async () => {
    await render(
      <TestWrapper>
        <Chip
          label="Monthly"
          selected
          accessibilityRole="radio"
          onPress={jest.fn()}
        />
      </TestWrapper>,
    );
    const chip = screen.getByRole('radio', { name: 'Monthly' });
    expect(chip.props.accessibilityState.checked).toBe(true);
  });

  it('should call onPress', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Chip label="Dairy" onPress={onPress} />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'Dairy' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should render as plain content, not a button, without onPress', async () => {
    await render(
      <TestWrapper>
        <Chip label="Tag" />
      </TestWrapper>,
    );
    expect(screen.getByText('Tag')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
