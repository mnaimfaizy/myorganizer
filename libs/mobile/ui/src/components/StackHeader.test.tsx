import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
import { LockAction } from './LockAction';
import { StackHeader } from './StackHeader';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('StackHeader', () => {
  it('should offer the way back as a button that calls onBack', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <StackHeader onBack={onBack} />
      </TestWrapper>,
    );

    await user.press(screen.getByRole('button', { name: 'Navigate up' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should draw no back control where there is nothing to go back to', async () => {
    await render(
      <TestWrapper>
        <StackHeader title="Home" />
      </TestWrapper>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  // Android gives the first Tab on a screen to the first focusable view in
  // mount order, so the order the controls are rendered in is the order a
  // hardware keyboard meets them in (#1029).
  it('should render the back control before the trailing actions', async () => {
    await render(
      <TestWrapper>
        <StackHeader
          onBack={jest.fn()}
          trailing={<LockAction onPress={jest.fn()} />}
        />
      </TestWrapper>,
    );

    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel),
    ).toEqual(['Navigate up', 'Lock vault']);
  });

  it('should draw the focus ring on the back control when it takes focus', async () => {
    await render(
      <TestWrapper>
        <StackHeader onBack={jest.fn()} />
      </TestWrapper>,
    );
    const back = screen.getByRole('button', { name: 'Navigate up' });

    await fireEvent(back, 'focus');

    const style = StyleSheet.flatten(
      screen.getByRole('button', { name: 'Navigate up' }).props.style,
    );
    expect(style.outlineWidth).toBe(2);
    expect(style.outlineColor).toBe(lightTheme.colors.focus);
  });

  it('should show the title inline, and the rule under the bar only with it', async () => {
    const { rerender } = await render(
      <TestWrapper>
        <StackHeader title="Weekly shop" onBack={jest.fn()} testID="bar" />
      </TestWrapper>,
    );
    expect(screen.getByText('Weekly shop')).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('bar').props.style)
        .borderBottomColor,
    ).toBe(lightTheme.colors.border);

    await rerender(
      <TestWrapper>
        <StackHeader onBack={jest.fn()} testID="bar" />
      </TestWrapper>,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('bar').props.style)
        .borderBottomColor,
    ).toBe('transparent');
  });

  // A screen that never titles its bar (Task detail, Subscription detail)
  // still needs the bar told apart from what scrolls under it (#948).
  it('should draw the rule under an untitled bar once content has scrolled under it', async () => {
    const { rerender } = await render(
      <TestWrapper>
        <StackHeader onBack={jest.fn()} testID="bar" />
      </TestWrapper>,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('bar').props.style)
        .borderBottomColor,
    ).toBe('transparent');

    await rerender(
      <TestWrapper>
        <StackHeader onBack={jest.fn()} scrolledUnder testID="bar" />
      </TestWrapper>,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('bar').props.style)
        .borderBottomColor,
    ).toBe(lightTheme.colors.border);
  });
});
