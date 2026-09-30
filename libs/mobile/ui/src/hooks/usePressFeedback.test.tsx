import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
import { usePressFeedback, withAlpha } from './usePressFeedback';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('usePressFeedback', () => {
  it('fills a pressed control with the accent role on iOS, and no ripple', async () => {
    const { result } = await renderHook(() => usePressFeedback(), { wrapper });
    expect(result.current.android_ripple).toBeUndefined();
    expect(result.current.pressedStyle(true)).toEqual({
      backgroundColor: lightTheme.colors.accent,
    });
    expect(result.current.pressedStyle(false)).toBeNull();
  });
});

describe('withAlpha', () => {
  it('turns a #rrggbb role into rgba at the given strength', () => {
    expect(withAlpha('#0f172a', 0.12)).toBe('rgba(15, 23, 42, 0.12)');
  });

  it('refuses a colour that is not #rrggbb', () => {
    expect(() => withAlpha('rgba(0, 0, 0, 0.6)', 0.12)).toThrow();
  });
});
