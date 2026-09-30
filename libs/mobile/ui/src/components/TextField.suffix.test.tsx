import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { Text } from './Text';
import { TextField } from './TextField';

// A Task's estimate: a number with its unit inside the field, and the
// field's own "Saving…" beside its label.

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('TextField — suffix and label accessory', () => {
  it('draws the suffix inside the field, hidden from the screen reader', async () => {
    await render(
      <TestWrapper>
        <TextField
          label="Estimate"
          accessibilityLabel="Estimate in minutes"
          suffix="minutes"
          value="45"
        />
      </TestWrapper>,
    );
    expect(screen.getByLabelText('Estimate in minutes')).toBeOnTheScreen();
    expect(screen.queryByText('minutes')).toBeNull();
    expect(
      screen.getByText('minutes', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('draws the label accessory beside the label', async () => {
    await render(
      <TestWrapper>
        <TextField
          label="Title"
          labelAccessory={<Text>Saving…</Text>}
          value="Renew passport"
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Title')).toBeOnTheScreen();
    expect(screen.getByText('Saving…')).toBeOnTheScreen();
  });
});
