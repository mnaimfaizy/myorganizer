import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { StatusPill } from './StatusPill';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('StatusPill Component', () => {
  it('should render neutral tone', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Neutral" tone="neutral" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Neutral')).toBeOnTheScreen();
  });

  it('should render success tone', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Completed" tone="success" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Completed')).toBeOnTheScreen();
  });

  it('should render warning tone', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Pending" tone="warning" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Pending')).toBeOnTheScreen();
  });

  it('should render destructive tone', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Failed" tone="destructive" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Failed')).toBeOnTheScreen();
  });

  it('should default to neutral tone', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Default" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Default')).toBeOnTheScreen();
  });

  it('should render in light mode', async () => {
    await render(
      <ThemeProvider appearance="light">
        <StatusPill label="Light" tone="success" />
      </ThemeProvider>,
    );
    expect(await screen.findByText('Light')).toBeOnTheScreen();
  });

  it('should render in dark mode', async () => {
    await render(
      <ThemeProvider appearance="dark">
        <StatusPill label="Dark" tone="success" />
      </ThemeProvider>,
    );
    expect(await screen.findByText('Dark')).toBeOnTheScreen();
  });

  it('should render the brand tone', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Encrypted" tone="brand" />
      </TestWrapper>,
    );
    expect(await screen.findByText('Encrypted')).toBeOnTheScreen();
  });

  it('should set the label in the uppercase label-caps step', async () => {
    await render(
      <TestWrapper>
        <StatusPill label="Manual" tone="warning" />
      </TestWrapper>,
    );
    const style = StyleSheet.flatten(screen.getByText('Manual').props.style);
    expect(style.textTransform).toBe('uppercase');
    expect(style.fontSize).toBe(12);
  });
});
