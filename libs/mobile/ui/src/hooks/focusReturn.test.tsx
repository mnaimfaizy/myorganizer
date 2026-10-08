import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { FocusEvent } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { useReturnFocusOnLeave } from './focusReturn';
import { useFocusRing } from './useFocusRing';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/** A focus event from `view`, as far as the hook reads one. */
const focusEventFrom = (view: unknown) =>
  ({ target: view, currentTarget: view }) as unknown as FocusEvent;

/** A control with a ring, and the view its focus events name. */
const renderControl = async () => {
  const view = { focus: jest.fn() };
  const control = await renderHook(() => useFocusRing(), { wrapper });
  return {
    view,
    focus: () =>
      act(() => control.result.current.onFocus(focusEventFrom(view))),
    blur: () => act(() => control.result.current.onBlur()),
    unmount: () => control.unmount(),
  };
};

/** A pushed screen: opened on render, left on unmount. */
const openScreen = () => renderHook(() => useReturnFocusOnLeave());

describe('useReturnFocusOnLeave', () => {
  it('returns focus to the control that held it when the screen opened', async () => {
    const row = await renderControl();
    await row.focus();
    const screen = await openScreen();
    // The new screen takes focus from the row once it is in the window.
    await row.blur();
    expect(row.view.focus).not.toHaveBeenCalled();

    await screen.unmount();
    expect(row.view.focus).toHaveBeenCalledTimes(1);
  });

  it('returns no focus when nothing held it, as after a touch', async () => {
    const row = await renderControl();
    await row.focus();
    // Touching the screen takes the window into touch mode, which blurs.
    await row.blur();
    const screen = await openScreen();

    await screen.unmount();
    expect(row.view.focus).not.toHaveBeenCalled();
  });

  it('does not take a control focused on the screen itself for its opener', async () => {
    const row = await renderControl();
    await row.focus();
    const screen = await openScreen();
    await row.blur();
    const back = await renderControl();
    await back.focus();

    await screen.unmount();
    expect(row.view.focus).toHaveBeenCalledTimes(1);
    expect(back.view.focus).not.toHaveBeenCalled();
    await back.blur();
  });

  it('unwinds a screen opened from another, one opener at a time', async () => {
    const row = await renderControl();
    await row.focus();
    const first = await openScreen();
    await row.blur();
    const link = await renderControl();
    await link.focus();
    const second = await openScreen();
    await link.blur();

    await second.unmount();
    expect(link.view.focus).toHaveBeenCalledTimes(1);
    expect(row.view.focus).not.toHaveBeenCalled();

    await first.unmount();
    expect(row.view.focus).toHaveBeenCalledTimes(1);
  });

  it('leaves focus alone when the opener has unmounted since', async () => {
    const row = await renderControl();
    await row.focus();
    const screen = await openScreen();
    // Deleted on the screen it opened, and never sent a blur.
    await row.unmount();

    await screen.unmount();
    expect(row.view.focus).not.toHaveBeenCalled();
  });

  it('forgets a control that unmounts while it holds focus', async () => {
    const row = await renderControl();
    await row.focus();
    await row.unmount();
    const screen = await openScreen();

    await screen.unmount();
    expect(row.view.focus).not.toHaveBeenCalled();
  });

  it('returns focus to the control that held it, not to the one around it', async () => {
    // Focus bubbles, so a row is sent the focus of the checkbox inside it.
    const checkbox = await renderControl();
    const row = await renderHook(() => useFocusRing(), { wrapper });
    await checkbox.focus();
    await act(() =>
      row.result.current.onFocus({
        target: checkbox.view,
        currentTarget: { focus: jest.fn() },
      } as unknown as FocusEvent),
    );
    const screen = await openScreen();
    await checkbox.blur();

    await screen.unmount();
    expect(checkbox.view.focus).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no event', undefined],
    ["the legacy renderer's tag", focusEventFrom(7)],
    ['no target', focusEventFrom(null)],
  ])('notes nothing for a focus that carries %s', async (_name, event) => {
    const control = await renderHook(() => useFocusRing(), { wrapper });
    await act(() => control.result.current.onFocus(event));
    expect(control.result.current.focused).toBe(true);
    const screen = await openScreen();

    await expect(screen.unmount()).resolves.not.toThrow();
    await act(() => control.result.current.onBlur());
  });
});
