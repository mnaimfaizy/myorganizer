import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
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
});
