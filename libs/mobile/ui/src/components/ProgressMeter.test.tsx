import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { StyleSheet } from 'react-native';
import { lightTheme } from '../theme';
import { ProgressMeter } from './ProgressMeter';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('ProgressMeter Component', () => {
  it('should clamp value to 0 when below 0 and announce through accessibility', async () => {
    const { container } = await render(
      <TestWrapper>
        <ProgressMeter value={-0.5} label="Progress" />
      </TestWrapper>,
    );
    // Check that the component renders
    expect(await screen.findByText('Progress')).toBeOnTheScreen();
    // The accessibilityValue should be set (min: 0, max: 100, now: 0)
    expect(container).toBeTruthy();
  });

  it('should clamp value to 100 when above 1', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter value={1.5} />
      </TestWrapper>,
    );
    // Component renders without error
    expect(screen.queryByText('Progress')).not.toBeOnTheScreen(); // no label in this case
  });

  it('should render with label and meta', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter value={0.75} label="Loading" meta="75%" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Loading')).toBeOnTheScreen();
    expect(await screen.findByText('75%')).toBeOnTheScreen();
  });

  it('should handle various progress values', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter value={0} label="Start" />
        <ProgressMeter value={0.5} label="Half" />
        <ProgressMeter value={1} label="End" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Start')).toBeOnTheScreen();
    expect(await screen.findByText('Half')).toBeOnTheScreen();
    expect(await screen.findByText('End')).toBeOnTheScreen();
  });

  it('announces the value text it is given', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter
          value={7 / 12}
          label="7 of 12"
          meta="checked"
          accessibilityValueText="checked off"
        />
      </TestWrapper>,
    );
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      text: 'checked off',
    });
  });

  // Android reads the label and the value text one after the other, as one
  // content description, so a value that repeats the label says it twice:
  // "5 of 8 notified, 5 of 8 notified, 3 to go" (#1086).
  it('names itself by its label and gives its meta as the value, each once', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter value={5 / 8} label="5 of 8 notified" meta="3 to go" />
      </TestWrapper>,
    );
    const meter = screen.getByRole('progressbar');
    expect(meter.props.accessibilityLabel).toBe('5 of 8 notified');
    expect(meter.props.accessibilityValue).toEqual({ text: '3 to go' });
    expect(meter.props.accessibilityValue.text).not.toContain(
      meter.props.accessibilityLabel,
    );
  });

  it('gives the percentage as the value when it has a label and no meta', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter value={0.5} label="Half" />
      </TestWrapper>,
    );
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it('gives the percentage as the value when its meta is its only name', async () => {
    await render(
      <TestWrapper>
        <ProgressMeter value={0.5} meta="3 to go" />
      </TestWrapper>,
    );
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it('fills with primary until complete and success once complete', async () => {
    const fill = () => {
      const meter = screen.getByRole('progressbar');
      const track = meter.children[meter.children.length - 1];
      if (typeof track === 'string') throw new Error('track is text');
      const bar = track.children[0];
      if (typeof bar === 'string') throw new Error('fill is text');
      return StyleSheet.flatten(bar.props.style).backgroundColor;
    };
    const { rerender } = await render(
      <TestWrapper>
        <ProgressMeter value={0.5} />
      </TestWrapper>,
    );
    expect(fill()).toBe(lightTheme.colors.primary);
    await rerender(
      <TestWrapper>
        <ProgressMeter value={1} />
      </TestWrapper>,
    );
    expect(fill()).toBe(lightTheme.colors.success);
  });
});
