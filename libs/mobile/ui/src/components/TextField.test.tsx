import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { TEXT_SCALE_CAP, MIN_TOUCH_TARGET } from '../metrics';
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

  describe('Reveal toggle', () => {
    it('should not render reveal toggle when revealable is not set, and pass through secureTextEntry unchanged', async () => {
      await render(
        <TestWrapper>
          <TextField testID="secure-input" secureTextEntry={true} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('secure-input');
      // secureTextEntry should pass through from caller unchanged
      expect(input.props.secureTextEntry).toBe(true);
      // No button with "password" in accessible name should exist
      expect(
        screen.queryByRole('button', {
          name: /password/i,
        }),
      ).toBeNull();
    });

    it('should render reveal toggle with default "password" label when revealable is true', async () => {
      await render(
        <TestWrapper>
          <TextField testID="reveal-input" revealable={true} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('reveal-input');
      // Initial state: revealed = false, so secureTextEntry should be true
      expect(input.props.secureTextEntry).toBe(true);
      // Reveal button should have "Show password" accessible name
      const revealButton = screen.getByRole('button', {
        name: 'Show password',
      });
      expect(revealButton).toBeOnTheScreen();
    });

    it('should toggle secureTextEntry and accessible label when reveal button is pressed', async () => {
      await render(
        <TestWrapper>
          <TextField testID="toggle-input" revealable={true} />
        </TestWrapper>,
      );
      const input = screen.getByTestId('toggle-input');
      const revealButton = screen.getByRole('button', {
        name: 'Show password',
      });

      // Initial state: secureTextEntry true
      expect(input.props.secureTextEntry).toBe(true);

      // Press the button to reveal
      fireEvent.press(revealButton);

      // Wait for state update and re-render
      await waitFor(() => {
        const updatedInput = screen.getByTestId('toggle-input');
        expect(updatedInput.props.secureTextEntry).toBe(false);
      });

      // Button label should change to "Hide password"
      const hideButton = screen.getByRole('button', { name: 'Hide password' });
      expect(hideButton).toBeOnTheScreen();

      // Press again to hide
      fireEvent.press(hideButton);

      // Wait for state update back to hidden
      await waitFor(() => {
        const updatedInput = screen.getByTestId('toggle-input');
        expect(updatedInput.props.secureTextEntry).toBe(true);
      });

      // Button should be back to "Show password"
      expect(
        screen.getByRole('button', { name: 'Show password' }),
      ).toBeOnTheScreen();
    });

    it('should use custom revealLabel in accessible names when provided', async () => {
      await render(
        <TestWrapper>
          <TextField
            testID="passphrase-input"
            revealable={true}
            revealLabel="passphrase"
          />
        </TestWrapper>,
      );
      const input = screen.getByTestId('passphrase-input');
      // Initial: should show "Show passphrase"
      const revealButton = screen.getByRole('button', {
        name: 'Show passphrase',
      });
      expect(revealButton).toBeOnTheScreen();
      expect(input.props.secureTextEntry).toBe(true);

      // Press to reveal
      fireEvent.press(revealButton);

      // Wait for state update
      await waitFor(() => {
        const hideButton = screen.getByRole('button', {
          name: 'Hide passphrase',
        });
        expect(hideButton).toBeOnTheScreen();
      });

      // Verify the input's secureTextEntry was toggled
      const updatedInput = screen.getByTestId('passphrase-input');
      expect(updatedInput.props.secureTextEntry).toBe(false);

      // Verify "password" is not in any button name
      expect(screen.queryByRole('button', { name: /password/i })).toBeNull();
    });

    it('should render reveal toggle with minimum touch target dimensions', async () => {
      await render(
        <TestWrapper>
          <TextField testID="touch-target-input" revealable={true} />
        </TestWrapper>,
      );
      const revealButton = screen.getByRole('button', {
        name: 'Show password',
      });
      // The button's style should have minHeight and minWidth >= MIN_TOUCH_TARGET
      const buttonStyle = revealButton.props.style;
      // buttonStyle can be an array, so we need to find the one with minHeight/minWidth
      let foundMinHeight = false;
      let foundMinWidth = false;

      if (Array.isArray(buttonStyle)) {
        for (const style of buttonStyle) {
          if (style != null && typeof style === 'object') {
            if (
              style.minHeight != null &&
              style.minHeight >= MIN_TOUCH_TARGET
            ) {
              foundMinHeight = true;
            }
            if (style.minWidth != null && style.minWidth >= MIN_TOUCH_TARGET) {
              foundMinWidth = true;
            }
          }
        }
      } else if (buttonStyle != null && typeof buttonStyle === 'object') {
        if (
          buttonStyle.minHeight != null &&
          buttonStyle.minHeight >= MIN_TOUCH_TARGET
        ) {
          foundMinHeight = true;
        }
        if (
          buttonStyle.minWidth != null &&
          buttonStyle.minWidth >= MIN_TOUCH_TARGET
        ) {
          foundMinWidth = true;
        }
      }

      expect(foundMinHeight).toBe(true);
      expect(foundMinWidth).toBe(true);
    });
  });

  describe('Design fidelity', () => {
    it('should set the label in sentence case at 600, not as a caps label', async () => {
      await render(
        <TestWrapper>
          <TextField label="Task title" />
        </TestWrapper>,
      );
      const style = StyleSheet.flatten(
        screen.getByText('Task title').props.style,
      );
      expect(style.textTransform).toBeUndefined();
      expect(style.fontSize).toBe(15);
    });

    it('should draw the reveal toggle as an in-field glyph, not a Show/Hide text button', async () => {
      await render(
        <TestWrapper>
          <TextField label="Passphrase" revealable revealLabel="passphrase" />
        </TestWrapper>,
      );
      expect(
        screen.getByRole('button', { name: 'Show passphrase' }),
      ).toBeOnTheScreen();
      expect(screen.queryByText('Show')).toBeNull();
      expect(screen.queryByText('Hide')).toBeNull();
    });

    it('should render the error as a line under the field with no boxed notice', async () => {
      await render(
        <TestWrapper>
          <TextField label="Task title" error="Give the task a title" />
        </TestWrapper>,
      );
      const alert = screen.getByRole('alert');
      expect(StyleSheet.flatten(alert.props.style).borderWidth).toBeUndefined();
      expect(screen.getByText('Give the task a title')).toBeOnTheScreen();
    });

    it('should render a prefix inside the field and name it with the label', async () => {
      await render(
        <TestWrapper>
          <TextField label="Amount" prefix="A$" value="22.99" />
        </TestWrapper>,
      );
      expect(
        screen.getByText('A$', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(screen.getByLabelText('Amount, A$').props.value).toBe('22.99');
    });

    it('should offer a clear accessory only while the field holds a value', async () => {
      const onClear = jest.fn();
      const { rerender } = await render(
        <TestWrapper>
          <TextField label="Next billing date" value="" onClear={onClear} />
        </TestWrapper>,
      );
      expect(
        screen.queryByRole('button', { name: 'Clear next billing date' }),
      ).toBeNull();

      await rerender(
        <TestWrapper>
          <TextField
            label="Next billing date"
            value="2026-09-29"
            onClear={onClear}
          />
        </TestWrapper>,
      );
      fireEvent.press(
        screen.getByRole('button', { name: 'Clear next billing date' }),
      );
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('Leading icon', () => {
    it('draws the glyph before the value, hidden from a screen reader', async () => {
      await render(
        <TestWrapper>
          <TextField
            icon="search"
            placeholder="Search your Catalog"
            accessibilityLabel="Search your Catalog"
          />
        </TestWrapper>,
      );
      const icon = screen.getByTestId('text-field-icon', {
        includeHiddenElements: true,
      });
      expect(icon.props.accessibilityElementsHidden).toBe(true);
      expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(screen.getByLabelText('Search your Catalog')).toBeOnTheScreen();
    });

    it('draws no glyph without an icon', async () => {
      await render(
        <TestWrapper>
          <TextField placeholder="List name" />
        </TestWrapper>,
      );
      expect(
        screen.queryByTestId('text-field-icon', {
          includeHiddenElements: true,
        }),
      ).toBeNull();
    });
  });
});
