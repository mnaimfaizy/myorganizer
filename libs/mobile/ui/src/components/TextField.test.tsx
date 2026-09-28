import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { TEXT_SCALE_CAP } from '../metrics';
import { TextField } from './TextField';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('TextField Component', () => {
  describe('Text scale cap', () => {
    it('should render TextInput with default maxFontSizeMultiplier equal to TEXT_SCALE_CAP', async () => {
      await render(
        <TestWrapper>
          <TextField testID="test-input" />
        </TestWrapper>,
      );
      const input = screen.getByTestId('test-input');
      expect(input.props.maxFontSizeMultiplier).toBe(TEXT_SCALE_CAP);
    });

    it('should use caller-supplied maxFontSizeMultiplier over default', async () => {
      await render(
        <TestWrapper>
          <TextField testID="custom-input" maxFontSizeMultiplier={1.5} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('custom-input');
      expect(input.props.maxFontSizeMultiplier).toBe(1.5);
    });
  });

  describe('Error state and announcement', () => {
    it('should not render alert when error is not set', async () => {
      await render(
        <TestWrapper>
          <TextField label="Name" />
        </TestWrapper>,
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('should render alert role when error is set', async () => {
      await render(
        <TestWrapper>
          <TextField label="Email" error="Invalid email" />
        </TestWrapper>,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toBeOnTheScreen();
    });

    it('should render error message in alert', async () => {
      await render(
        <TestWrapper>
          <TextField label="Email" error="Email is required" />
        </TestWrapper>,
      );
      const alert = screen.getByRole('alert');
      expect(screen.getByText('Email is required')).toBeOnTheScreen();
      expect(alert).toBeOnTheScreen();
    });

    it('should not render hint when error is set', async () => {
      await render(
        <TestWrapper>
          <TextField
            label="Email"
            hint="e.g. user@example.com"
            error="Invalid email"
          />
        </TestWrapper>,
      );
      expect(screen.queryByText('e.g. user@example.com')).toBeNull();
    });

    it('should render hint when error is not set', async () => {
      await render(
        <TestWrapper>
          <TextField label="Email" hint="e.g. user@example.com" />
        </TestWrapper>,
      );
      expect(screen.getByText('e.g. user@example.com')).toBeOnTheScreen();
    });

    it('should hide alert when error is cleared', async () => {
      const { rerender } = await render(
        <TestWrapper>
          <TextField label="Email" error="Invalid email" />
        </TestWrapper>,
      );
      expect(screen.getByRole('alert')).toBeOnTheScreen();

      await rerender(
        <TestWrapper>
          <TextField label="Email" />
        </TestWrapper>,
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('Label rendering', () => {
    it('should render label when provided', async () => {
      await render(
        <TestWrapper>
          <TextField label="Username" />
        </TestWrapper>,
      );
      expect(screen.getByText('Username')).toBeOnTheScreen();
    });

    it('should not render label when not provided', async () => {
      await render(
        <TestWrapper>
          <TextField testID="no-label-input" />
        </TestWrapper>,
      );
      // The component just won't render the label View
      expect(screen.queryByText(/./)).toBeFalsy();
    });
  });

  describe('Focus state', () => {
    it('should call onFocus when field is focused', async () => {
      const onFocus = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <TextField testID="focus-input" onFocus={onFocus} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('focus-input');
      await user.type(input, 'test');
      expect(onFocus).toHaveBeenCalled();
    });

    it('should call onBlur when field loses focus', async () => {
      const onBlur = jest.fn();
      await render(
        <TestWrapper>
          <TextField testID="blur-input" onBlur={onBlur} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('blur-input');
      input.props.onBlur?.();
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    it('should mark disabled state in accessibility', async () => {
      await render(
        <TestWrapper>
          <TextField testID="disabled-input" editable={false} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('disabled-input');
      expect(input.props.accessibilityState.disabled).toBe(true);
    });

    it('should not mark as disabled when editable is true', async () => {
      await render(
        <TestWrapper>
          <TextField testID="enabled-input" editable={true} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('enabled-input');
      expect(input.props.accessibilityState.disabled).toBe(false);
    });
  });
});
