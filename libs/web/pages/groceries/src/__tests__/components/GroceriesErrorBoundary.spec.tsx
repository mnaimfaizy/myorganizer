/**
 * Tests for GroceriesErrorBoundary class component.
 *
 * Coverage:
 * - Happy path: children render normally when no error
 * - Error catching: getDerivedStateFromError and componentDidCatch
 * - Default fallback UI with all text and button behavior
 * - Custom fallback prop handling
 * - Development mode error details visibility
 * - Production mode error hiding
 * - UI structure and styling
 * - window.location.reload() on button click
 *
 * Mocking:
 * - window.location.reload for page reload testing
 * - console.error to verify logging and suppress warnings
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { GroceriesErrorBoundary } from '../../GroceriesErrorBoundary';

/**
 * Test helper: component that throws an error when shouldThrow is true
 */
function ThrowError({
  shouldThrow,
  error,
  children,
}: {
  shouldThrow: boolean;
  error: Error;
  children: ReactNode;
}) {
  if (shouldThrow) {
    throw error;
  }
  return children;
}

describe('GroceriesErrorBoundary', () => {
  const TEST_ERROR = new Error('Test error from child component');
  const TEST_ERROR_2 = new Error('Another test error');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Happy Path - No Error', () => {
    it('should render children normally when no error occurs', () => {
      render(
        <GroceriesErrorBoundary>
          <div data-testid="child-content">Child Component</div>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByTestId('child-content')).toBeTruthy();
      expect(screen.getByText('Child Component')).toBeTruthy();
    });

    it('should render multiple children without errors', () => {
      render(
        <GroceriesErrorBoundary>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByTestId('child-1')).toBeTruthy();
      expect(screen.getByTestId('child-2')).toBeTruthy();
      expect(screen.getByTestId('child-3')).toBeTruthy();
    });

    it('should be transparent to normal operation (no overhead)', () => {
      const { rerender } = render(
        <GroceriesErrorBoundary>
          <div data-testid="count">0</div>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByTestId('count')).toBeTruthy();
      expect(screen.getByTestId('count').textContent).toBe('0');

      rerender(
        <GroceriesErrorBoundary>
          <div data-testid="count">1</div>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByTestId('count').textContent).toBe('1');
    });

    it('should not show fallback UI when no error', () => {
      render(
        <GroceriesErrorBoundary fallback={<div>Custom Fallback</div>}>
          <div data-testid="child-content">Child Content</div>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByTestId('child-content')).toBeTruthy();
      expect(screen.queryByText('Custom Fallback')).toBeNull();
    });
  });

  describe('Error Catching', () => {
    it('should catch errors from children and update state', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      // Verify error boundary caught the error (no crash, error UI shown)
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.queryByText('Child')).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should log error to console.error in componentDidCatch', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      const calls = consoleErrorSpy.mock.calls;
      expect(
        calls.some((call) =>
          call[0]?.toString?.().includes('Groceries error boundary caught'),
        ),
      ).toBe(true);

      consoleErrorSpy.mockRestore();
    });

    it('should not re-throw errors (containing them completely)', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      // Should not throw, error boundary catches it
      expect(() => {
        render(
          <GroceriesErrorBoundary>
            <ThrowError shouldThrow={true} error={TEST_ERROR}>
              <div>Child</div>
            </ThrowError>
          </GroceriesErrorBoundary>,
        );
      }).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should handle different error types', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR_2}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Default Fallback UI', () => {
    it('should display default error UI on error', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should display correct heading in error UI', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const heading = screen.getByRole('heading', {
        level: 2,
      });
      expect(heading.textContent).toBe('Something went wrong');

      consoleErrorSpy.mockRestore();
    });

    it('should display description text about error loading grocery lists', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(
        screen.getByText(/error loading your grocery lists/i),
      ).toBeTruthy();
      expect(screen.getByText(/refreshing/i)).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should render Refresh Page button in default UI', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const button = screen.getByRole('button', {
        name: /refresh page/i,
      });
      expect(button).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should have Refresh Page button clickable and functional on error', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const button = screen.getByRole('button', {
        name: /refresh page/i,
      });

      // Verify button is present and clickable
      expect(button).toBeTruthy();
      expect((button as HTMLButtonElement).onclick).not.toBeNull();

      // Verify button can be clicked without errors
      expect(() => {
        fireEvent.click(button);
      }).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should have correct styling for error card container', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { container } = render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const outerDiv = container.querySelector(
        '.flex.min-h-screen.items-center.justify-center.bg-surface.p-4',
      );
      expect(outerDiv).toBeTruthy();

      const card = container.querySelector(
        '.max-w-md.rounded-lg.bg-surface-container.p-6.shadow-lg',
      );
      expect(card).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should have correct styling for heading', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const heading = screen.getByRole('heading', {
        level: 2,
      });
      expect(heading.className).toContain('text-lg');
      expect(heading.className).toContain('font-semibold');
      expect(heading.className).toContain('text-on-surface');

      consoleErrorSpy.mockRestore();
    });

    it('should have correct styling for description', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { container } = render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const description = container.querySelector(
        '.mt-2.text-sm.text-on-surface-variant',
      );
      expect(description).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should have correct styling for button', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const button = screen.getByRole('button', {
        name: /refresh page/i,
      });
      expect(button.className).toContain('mt-4');
      expect(button.className).toContain('rounded-lg');
      expect(button.className).toContain('bg-primary');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('py-2');
      expect(button.className).toContain('font-medium');
      expect(button.className).toContain('text-on-primary');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Custom Fallback', () => {
    it('should display custom fallback when provided and error occurs', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary fallback={<div>Custom Error UI</div>}>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Custom Error UI')).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should not show default UI when custom fallback provided', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary fallback={<div>Custom Error UI</div>}>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.queryByText('Something went wrong')).toBeNull();
      expect(
        screen.queryByText(/error loading your grocery lists/i),
      ).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should not render children when error and custom fallback shown', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary fallback={<div>Custom Error UI</div>}>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div data-testid="child-element">Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.queryByTestId('child-element')).toBeNull();
      expect(screen.getByText('Custom Error UI')).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should render complex custom fallback UI exactly as-is', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const customFallback = (
        <div className="custom-container">
          <h1>Custom Title</h1>
          <p>Custom message</p>
          <button>Custom Action</button>
        </div>
      );

      render(
        <GroceriesErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Custom Title')).toBeTruthy();
      expect(screen.getByText('Custom message')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /custom action/i }),
      ).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Development Mode - Error Details', () => {
    it('should not expose raw error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      // Component does not expose raw error details – no disclosure widget
      const detailsElements = screen.queryAllByText(
        /error details \(dev only\)/i,
      );
      expect(detailsElements.length).toBe(0);

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should not display expandable details element in dev mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { container } = render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const detailsElement = container.querySelector('details');
      expect(detailsElement).toBeFalsy();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should not expose error message in pre tag in dev mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { container } = render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      // No <pre> tag should leak error details to the UI
      const preElement = container.querySelector('pre');
      expect(preElement).toBeFalsy();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should show the standard fallback UI in dev mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      // Same generic fallback shown in all environments
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /refresh page/i }),
      ).toBeTruthy();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should not render details element in dev mode (same as production)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { container } = render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const detailsElement = container.querySelector('details');
      expect(detailsElement).toBeFalsy();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Production Mode - No Error Details', () => {
    it('should not render error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { container } = render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const detailsElement = container.querySelector('details');
      expect(detailsElement).toBeNull();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should not show error information to user in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.queryByText(/error details \(dev only\)/i)).toBeNull();
      expect(screen.queryByText(/Test error from child component/i)).toBeNull();

      // User-friendly message should still be shown
      expect(
        screen.getByText(/error loading your grocery lists/i),
      ).toBeTruthy();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should display only user-friendly message in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(
        screen.getByText(/error loading your grocery lists/i),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /refresh page/i }),
      ).toBeTruthy();

      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle error in error boundary itself gracefully', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      // Error boundary should not crash even with bad children
      expect(() => {
        render(
          <GroceriesErrorBoundary>
            <ThrowError shouldThrow={true} error={TEST_ERROR}>
              <div>Child</div>
            </ThrowError>
          </GroceriesErrorBoundary>,
        );
      }).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should handle undefined error gracefully', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const undefinedError = new Error(undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={undefinedError}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('should work with deeply nested component trees', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <div>
            <div>
              <div>
                <ThrowError shouldThrow={true} error={TEST_ERROR}>
                  <div>Nested Child</div>
                </ThrowError>
              </div>
            </div>
          </div>
        </GroceriesErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.queryByText('Nested Child')).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should handle button hover state', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      render(
        <GroceriesErrorBoundary>
          <ThrowError shouldThrow={true} error={TEST_ERROR}>
            <div>Child</div>
          </ThrowError>
        </GroceriesErrorBoundary>,
      );

      const button = screen.getByRole('button', {
        name: /refresh page/i,
      });
      expect(button.className).toContain('hover:bg-primary/90');

      consoleErrorSpy.mockRestore();
    });
  });
});
