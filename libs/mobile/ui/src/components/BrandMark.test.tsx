import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { BrandMark } from './BrandMark';
import { PrivacyCover } from './PrivacyCover';

describe('BrandMark Component', () => {
  it('should be one image named MyOrganizer', async () => {
    await render(
      <ThemeProvider appearance="light">
        <BrandMark lockup="inline" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('image', { name: 'MyOrganizer' })).toBeTruthy();
  });

  it('should draw the two-weight wordmark in the stacked lockup, and none for the mark alone', async () => {
    const { rerender } = await render(
      <ThemeProvider appearance="light">
        <BrandMark lockup="stacked" />
      </ThemeProvider>,
    );
    expect(
      screen.getByText('Organizer', { includeHiddenElements: true }),
    ).toBeTruthy();

    await rerender(
      <ThemeProvider appearance="light">
        <BrandMark lockup="mark" />
      </ThemeProvider>,
    );
    expect(
      screen.queryByText('Organizer', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('should put the brand lockup on the privacy cover', async () => {
    await render(
      <ThemeProvider appearance="dark">
        <PrivacyCover visible />
      </ThemeProvider>,
    );
    expect(
      screen.getByLabelText('MyOrganizer', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
