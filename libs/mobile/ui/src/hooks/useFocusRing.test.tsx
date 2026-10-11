import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Platform, type FocusEvent } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
import { useFocusRing } from './useFocusRing';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/** A focus or blur event as far as the hook reads one. */
const eventAt = (target: unknown, currentTarget: unknown) =>
  ({ target, currentTarget }) as unknown as FocusEvent;

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

  // Focus and blur bubble: a row is sent its checkbox's (#1047).
  describe('on a control with a ringed control inside it', () => {
    const row = { focus: jest.fn() };
    const checkbox = { focus: jest.fn() };

    it('draws the ring for its own focus', async () => {
      const { result } = await renderHook(() => useFocusRing(), { wrapper });
      await act(() => result.current.onFocus(eventAt(row, row)));
      expect(result.current.ringStyle).not.toBeNull();
    });

    it('draws no ring when the control inside it takes focus', async () => {
      const { result } = await renderHook(() => useFocusRing(), { wrapper });
      await act(() => result.current.onFocus(eventAt(checkbox, row)));
      expect(result.current.focused).toBe(false);
      expect(result.current.ringStyle).toBeNull();
    });

    it('keeps its ring when the control inside it loses focus', async () => {
      const { result } = await renderHook(() => useFocusRing(), { wrapper });
      await act(() => result.current.onFocus(eventAt(row, row)));
      await act(() => result.current.onBlur(eventAt(checkbox, row)));
      expect(result.current.ringStyle).not.toBeNull();
    });

    it('clears the ring on its own blur', async () => {
      const { result } = await renderHook(() => useFocusRing(), { wrapper });
      await act(() => result.current.onFocus(eventAt(row, row)));
      await act(() => result.current.onBlur(eventAt(row, row)));
      expect(result.current.ringStyle).toBeNull();
    });
  });

  describe('ripple', () => {
    const own = { color: '#00ff00', borderless: true, radius: 8 };

    describe('off Android', () => {
      it('hands back the own ripple, and undefined stays undefined, focused or not', async () => {
        const { result } = await renderHook(() => useFocusRing(), { wrapper });
        expect(result.current.ripple(own)).toBe(own);
        expect(result.current.ripple()).toBeUndefined();
        await act(() => result.current.onFocus());
        expect(result.current.ripple(own)).toBe(own);
        expect(result.current.ripple()).toBeUndefined();
      });
    });

    describe('on Android', () => {
      beforeEach(() => {
        jest.replaceProperty(Platform, 'OS', 'android');
      });
      afterEach(() => jest.restoreAllMocks());

      it('gives a control with no ripple a transparent foreground one, focused or not', async () => {
        const { result } = await renderHook(() => useFocusRing(), { wrapper });
        const transparent = { color: 'transparent', foreground: true };
        expect(result.current.ripple()).toEqual(transparent);
        await act(() => result.current.onFocus());
        expect(result.current.ripple()).toEqual(transparent);
      });

      it('hands back the own ripple by reference while not focused', async () => {
        const { result } = await renderHook(() => useFocusRing(), { wrapper });
        expect(result.current.ripple(own)).toBe(own);
      });

      it('keeps the own ripple shape but makes its colour transparent while focused', async () => {
        const { result } = await renderHook(() => useFocusRing(), { wrapper });
        await act(() => result.current.onFocus());
        expect(result.current.ripple(own)).toEqual({
          ...own,
          color: 'transparent',
        });
      });

      it('restores the own ripple on blur', async () => {
        const { result } = await renderHook(() => useFocusRing(), { wrapper });
        await act(() => result.current.onFocus());
        await act(() => result.current.onBlur());
        expect(result.current.ripple(own)).toBe(own);
      });

      it('keeps the own ripple when a control inside it takes focus', async () => {
        const row = { focus: jest.fn() };
        const checkbox = { focus: jest.fn() };
        const { result } = await renderHook(() => useFocusRing(), { wrapper });
        await act(() => result.current.onFocus(eventAt(checkbox, row)));
        expect(result.current.ripple(own)).toBe(own);
      });
    });
  });
});
