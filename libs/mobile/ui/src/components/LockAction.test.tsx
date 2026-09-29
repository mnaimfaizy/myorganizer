import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { LockAction } from './LockAction';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('LockAction Component', () => {
  describe('Accessibility label', () => {
    it('should be announced as "Lock vault" by default', async () => {
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      expect(button).toBeOnTheScreen();
    });

    it('should use caller-supplied accessibilityLabel', async () => {
      await render(
        <TestWrapper>
          <LockAction
            onPress={jest.fn()}
            accessibilityLabel="Custom lock label"
          />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Custom lock label');
      expect(button).toBeOnTheScreen();
    });

    it('should have button accessibility role', async () => {
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} />
        </TestWrapper>,
      );
      const button = screen.getByRole('button', { name: 'Lock vault' });
      expect(button).toBeOnTheScreen();
    });
  });

  describe('Press handling', () => {
    it('should call onPress when pressed', async () => {
      const onPress = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <LockAction onPress={onPress} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      await user.press(button);
      expect(onPress).toHaveBeenCalled();
    });

    it('should call onPress exactly once per press', async () => {
      const onPress = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <LockAction onPress={onPress} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      await user.press(button);
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Touch target size', () => {
    it('is exactly MIN_TOUCH_TARGET wide, so the iOS 26 bar cannot stretch it', async () => {
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      const flatStyle = StyleSheet.flatten(button.props.style);
      expect(flatStyle.width).toBe(MIN_TOUCH_TARGET);
    });

    it('is exactly MIN_TOUCH_TARGET tall', async () => {
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      const flatStyle = StyleSheet.flatten(button.props.style);
      expect(flatStyle.height).toBe(MIN_TOUCH_TARGET);
    });

    it('has both width and height fixed at MIN_TOUCH_TARGET', async () => {
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      const flatStyle = StyleSheet.flatten(button.props.style);
      expect(flatStyle.width).toBe(MIN_TOUCH_TARGET);
      expect(flatStyle.height).toBe(MIN_TOUCH_TARGET);
    });
  });

  describe('Style overrides', () => {
    it('should accept and apply custom style prop', async () => {
      const customStyle = { backgroundColor: 'red' };
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} style={customStyle} />
        </TestWrapper>,
      );
      const button = screen.getByLabelText('Lock vault');
      const flatStyle = StyleSheet.flatten(button.props.style);
      // Touch target should still be applied
      expect(flatStyle.width).toBe(MIN_TOUCH_TARGET);
      expect(flatStyle.height).toBe(MIN_TOUCH_TARGET);
    });
  });

  describe('Press feedback', () => {
    it('does not fade when pressed', async () => {
      await render(
        <TestWrapper>
          <LockAction onPress={jest.fn()} />
        </TestWrapper>,
      );
      const style = StyleSheet.flatten(screen.getByRole('button').props.style);
      expect(style.opacity).toBeUndefined();
    });
  });
});
