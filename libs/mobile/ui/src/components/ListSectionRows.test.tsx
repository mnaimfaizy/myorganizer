import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { lightTheme } from '../theme';
import { ThemeProvider } from '../useTheme';
import { ListRow } from './ListRow';
import { ListSectionRows } from './ListSection';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('ListSectionRows', () => {
  it('draws the full-bleed card band a section draws under its header', async () => {
    await render(
      <TestWrapper>
        <ListSectionRows>
          <ListRow title="Bananas" />
        </ListSectionRows>
      </TestWrapper>,
    );
    const band = StyleSheet.flatten(
      screen.getByTestId('list-section-rows').props.style,
    );
    expect(band.backgroundColor).toBe(lightTheme.colors.card);
    expect(band.borderColor).toBe(lightTheme.colors.border);
    expect(band.borderRadius).toBeUndefined();
  });

  it('gives every row but the last its inset divider', async () => {
    await render(
      <TestWrapper>
        <ListSectionRows>
          <ListRow key="a" title="Bananas" />
          <ListRow key="b" title="Lemons" />
          <ListRow key="c" title="Baby spinach" />
        </ListSectionRows>
      </TestWrapper>,
    );
    expect(
      screen.getAllByTestId('list-row-divider', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(2);
  });

  it('renders nothing when it holds no rows', async () => {
    await render(
      <TestWrapper>
        <ListSectionRows>{[]}</ListSectionRows>
      </TestWrapper>,
    );
    expect(screen.queryByTestId('list-section-rows')).toBeNull();
  });
});
