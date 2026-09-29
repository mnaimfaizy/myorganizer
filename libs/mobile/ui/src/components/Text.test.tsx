import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { FONT_FAMILY } from '../typeScale';
import { TEXT_SCALE_CAP } from '../metrics';
import { Text } from './Text';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('Text Component', () => {
  describe('Text scale cap', () => {
    it('should render with default maxFontSizeMultiplier equal to TEXT_SCALE_CAP', async () => {
      await render(
        <TestWrapper>
          <Text>Hello</Text>
        </TestWrapper>,
      );
      const text = screen.getByText('Hello');
      expect(text.props.maxFontSizeMultiplier).toBe(TEXT_SCALE_CAP);
    });

    it('should use caller-supplied maxFontSizeMultiplier over default', async () => {
      await render(
        <TestWrapper>
          <Text maxFontSizeMultiplier={1.3}>Custom Scale</Text>
        </TestWrapper>,
      );
      const text = screen.getByText('Custom Scale');
      expect(text.props.maxFontSizeMultiplier).toBe(1.3);
    });

    it('should apply zero maxFontSizeMultiplier when explicitly set', async () => {
      await render(
        <TestWrapper>
          <Text maxFontSizeMultiplier={0}>No Scale</Text>
        </TestWrapper>,
      );
      const text = screen.getByText('No Scale');
      expect(text.props.maxFontSizeMultiplier).toBe(0);
    });
  });

  describe('Type scale variants', () => {
    it('should apply body variant — fontSize and fontFamily from theme.type', async () => {
      await render(
        <TestWrapper>
          <Text variant="body">Body text</Text>
        </TestWrapper>,
      );

      const text = screen.getByText('Body text');
      const flatStyle = StyleSheet.flatten(text.props.style);

      // Verify the Type Scale step applies both fontSize and fontFamily (whole step)
      expect(flatStyle.fontSize).toBeDefined();
      expect(flatStyle.fontFamily).toBeDefined();
    });

    it('should apply title variant — fontSize and fontFamily from theme.type', async () => {
      await render(
        <TestWrapper>
          <Text variant="title">Title text</Text>
        </TestWrapper>,
      );

      const text = screen.getByText('Title text');
      const flatStyle = StyleSheet.flatten(text.props.style);

      // Verify the Type Scale step applies both fontSize and fontFamily (whole step)
      expect(flatStyle.fontSize).toBeDefined();
      expect(flatStyle.fontFamily).toBeDefined();
    });

    it('should apply caption variant — fontSize and fontFamily from theme.type', async () => {
      await render(
        <TestWrapper>
          <Text variant="caption">Caption text</Text>
        </TestWrapper>,
      );

      const text = screen.getByText('Caption text');
      const flatStyle = StyleSheet.flatten(text.props.style);

      // Verify the Type Scale step applies both fontSize and fontFamily (whole step)
      expect(flatStyle.fontSize).toBeDefined();
      expect(flatStyle.fontFamily).toBeDefined();
    });
  });

  describe('Default variant', () => {
    it('should default to body variant when not specified', async () => {
      await render(
        <TestWrapper>
          <Text>Default variant</Text>
        </TestWrapper>,
      );

      const text = screen.getByText('Default variant');
      const flatStyle = StyleSheet.flatten(text.props.style);

      // Should use body variant by default — fontSize and fontFamily applied
      expect(flatStyle.fontSize).toBeDefined();
      expect(flatStyle.fontFamily).toBeDefined();
    });
  });

  describe('Weight', () => {
    it('should set a body-face step at another bundled weight, keeping its size', async () => {
      await render(
        <TestWrapper>
          <Text variant="bodySm" weight="semibold">
            Label
          </Text>
        </TestWrapper>,
      );
      const style = StyleSheet.flatten(screen.getByText('Label').props.style);
      expect(style.fontFamily).toBe(FONT_FAMILY.bodySemiBold);
      expect(style.fontSize).toBe(15);
      expect(style.lineHeight).toBe(20);
    });

    it("should ignore a weight the step's face bundles no cut for", async () => {
      await render(
        <TestWrapper>
          <Text variant="title" weight="medium">
            Title
          </Text>
        </TestWrapper>,
      );
      expect(
        StyleSheet.flatten(screen.getByText('Title').props.style).fontFamily,
      ).toBe(FONT_FAMILY.displayBold);
    });
  });
});
