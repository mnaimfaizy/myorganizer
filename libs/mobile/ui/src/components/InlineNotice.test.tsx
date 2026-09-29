import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { InlineNotice } from './InlineNotice';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('InlineNotice Component', () => {
  describe('Accessibility: alert role and assertive live region', () => {
    it('should have alert role and assertive live region in destructive tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Error" tone="destructive" />
        </TestWrapper>,
      );
      const alert = screen.getByRole('alert');
      expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    });

    it('should have alert role and assertive live region in warning tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Warning" tone="warning" />
        </TestWrapper>,
      );
      const alert = screen.getByRole('alert');
      expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    });

    it('should have alert role and assertive live region in neutral tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Info" tone="neutral" />
        </TestWrapper>,
      );
      const alert = screen.getByRole('alert');
      expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    });

    it('should have alert role and assertive live region in dark mode', async () => {
      await render(
        <ThemeProvider appearance="dark">
          <InlineNotice message="Dark alert" tone="destructive" />
        </ThemeProvider>,
      );
      const alert = screen.getByRole('alert');
      expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    });
  });

  describe('Rendering content', () => {
    it('should render message', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Error occurred" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Error occurred')).toBeOnTheScreen();
    });

    it('should render with destructive tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Error occurred" tone="destructive" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Error occurred')).toBeOnTheScreen();
    });

    it('should render with warning tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Warning message" tone="warning" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Warning message')).toBeOnTheScreen();
    });

    it('should render with neutral tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Info message" tone="neutral" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Info message')).toBeOnTheScreen();
    });

    it('should default to neutral tone', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Default tone" />
        </TestWrapper>,
      );
      expect(await screen.findByText('Default tone')).toBeOnTheScreen();
    });
  });

  describe('Color modes', () => {
    it('should render in light mode', async () => {
      await render(
        <ThemeProvider appearance="light">
          <InlineNotice message="Light mode" tone="destructive" />
        </ThemeProvider>,
      );
      expect(await screen.findByText('Light mode')).toBeOnTheScreen();
    });

    it('should render in dark mode', async () => {
      await render(
        <ThemeProvider appearance="dark">
          <InlineNotice message="Dark mode" tone="destructive" />
        </ThemeProvider>,
      );
      expect(await screen.findByText('Dark mode')).toBeOnTheScreen();
    });
  });

  describe('Action button', () => {
    it('should render action button when both label and handler are provided', async () => {
      await render(
        <TestWrapper>
          <InlineNotice
            message="Error"
            actionLabel="Retry"
            onAction={jest.fn()}
          />
        </TestWrapper>,
      );
      expect(await screen.findByLabelText('Retry')).toBeOnTheScreen();
    });

    it('should not render action button when only label is provided', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Error" actionLabel="Retry" />
        </TestWrapper>,
      );
      expect(screen.queryByLabelText('Retry')).toBeNull();
    });

    it('should not render action button when only handler is provided', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Error" onAction={jest.fn()} />
        </TestWrapper>,
      );
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('should call onAction when action button is pressed', async () => {
      const onAction = jest.fn();
      const user = userEvent.setup();
      await render(
        <TestWrapper>
          <InlineNotice
            message="Error"
            actionLabel="Retry"
            onAction={onAction}
          />
        </TestWrapper>,
      );
      const button = await screen.findByLabelText('Retry');
      await user.press(button);
      expect(onAction).toHaveBeenCalled();
    });
  });

  describe('Variants', () => {
    it('should set an inline notice unboxed, and a card on the muted panel', async () => {
      await render(
        <TestWrapper>
          <InlineNotice message="Inline line" tone="warning" style={{}} />
          <InlineNotice
            message="Settings on this tab belong to this phone."
            tone="info"
            variant="card"
          />
        </TestWrapper>,
      );
      const [inline, card] = screen.getAllByRole('alert');
      expect(
        StyleSheet.flatten(inline.parent?.props.style).backgroundColor,
      ).toBeUndefined();
      let node = card.parent;
      let fill: unknown;
      while (node != null && fill === undefined) {
        fill = StyleSheet.flatten(node.props.style)?.backgroundColor;
        node = node.parent;
      }
      expect(fill).toBe('#eceef0');
    });
  });
});
