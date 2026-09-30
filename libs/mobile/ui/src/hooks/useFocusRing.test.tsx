import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
import { useFocusRing } from './useFocusRing';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('useFocusRing', () => {
  it('draws nothing until focused', async () => {
    const { result } = await renderHook(() => useFocusRing(), { wrapper });
    expect(result.current.ringStyle).toBeNull();
  });

  it('draws 2pt of the focus role with a 2pt gap outside the control', async () => {
    const { result } = await renderHook(() => useFocusRing(), { wrapper });
    await act(() => result.current.onFocus());
    expect(result.current.ringStyle).toEqual({
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineColor: lightTheme.colors.focus,
      outlineOffset: 2,
    });
  });

  it('draws the ring inset for a full-bleed control', async () => {
    const { result } = await renderHook(() => useFocusRing('inset'), {
      wrapper,
    });
    await act(() => result.current.onFocus());
    expect(result.current.ringStyle?.outlineOffset).toBe(-2);
  });

  it('clears the ring on blur', async () => {
    const { result } = await renderHook(() => useFocusRing(), { wrapper });
    await act(() => result.current.onFocus());
    await act(() => result.current.onBlur());
    expect(result.current.ringStyle).toBeNull();
  });
});
