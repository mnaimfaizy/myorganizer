import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { FocusEvent } from 'react-native';
import { ThemeProvider } from '../useTheme';
import type { FocusTarget } from './focusReturn';
import { useFocusRing } from './useFocusRing';
import {
  focusHeirs,
  useFocusSuccession,
  type FocusSuccessionOptions,
} from './useFocusSuccession';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/** A control with a ring, and the view its focus events name. */
const renderControl = async () => {
  const view = { focus: jest.fn() };
  const event = { target: view, currentTarget: view } as unknown as FocusEvent;
  const control = await renderHook(() => useFocusRing(), { wrapper });
  return {
    view,
    focus: () => act(() => control.result.current.onFocus(event)),
    blur: () => act(() => control.result.current.onBlur()),
    unmount: () => control.unmount(),
  };
};

/** Long enough for a commit to have reached the views. */
const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

type Row = Awaited<ReturnType<typeof renderControl>>;

/**
 * A list of rows, each a control of its own. `remove` takes rows out the way
 * React does: their refs are detached in the commit that drops their keys,
 * and their own cleanup runs after it.
 */
const renderList = async (
  names: readonly string[],
  options: FocusSuccessionOptions = {},
) => {
  const rows = new Map<string, Row>();
  for (const name of names) rows.set(name, await renderControl());
  const list = await renderHook(
    (props: { keys: readonly string[]; options: FocusSuccessionOptions }) =>
      useFocusSuccession(props.keys, props.options),
    { initialProps: { keys: names, options } },
  );
  const attach = (name: string): void =>
    list.result.current(name)(rows.get(name)?.view ?? null);
  await act(() => names.forEach(attach));
  let keys = names;
  let current = options;

  const row = (name: string): Row => {
    const found = rows.get(name);
    if (found === undefined) throw new Error(`no row ${name}`);
    return found;
  };

  return {
    row,
    remove: async (...gone: string[]) => {
      const refs = gone.map((name) => list.result.current(name));
      keys = keys.filter((name) => !gone.includes(name));
      await act(async () => {
        refs.forEach((ref) => ref(null));
        await list.rerender({ keys, options: current });
      });
      for (const name of gone) await row(name).unmount();
    },
    /** Unmounts a row's control and leaves its key listed. */
    detach: async (name: string) => {
      await act(async () => {
        list.result.current(name)(null);
        await list.rerender({ keys, options: current });
      });
    },
    setOptions: async (next: FocusSuccessionOptions) => {
      current = next;
      await list.rerender({ keys, options: current });
    },
    unmount: () => list.unmount(),
    focused: () =>
      [...rows]
        .filter(([, r]) => r.view.focus.mock.calls.length > 0)
        .map(([name]) => name),
  };
};

describe('focusHeirs', () => {
  it.each([
    ['the middle', 'b', ['c', 'd', 'a']],
    ['the first', 'a', ['b', 'c', 'd']],
    ['the last', 'd', ['c', 'b', 'a']],
  ])(
    'names the rows after %s, then the rows before it',
    (_name, key, heirs) => {
      expect(focusHeirs(['a', 'b', 'c', 'd'], key)).toEqual(heirs);
    },
  );

  it('names nobody for a key that was not listed, or was listed alone', () => {
    expect(focusHeirs(['a', 'b'], 'z')).toEqual([]);
    expect(focusHeirs(['a'], 'a')).toEqual([]);
  });
});

describe('useFocusSuccession', () => {
  it('hands focus to the next row when the focused row leaves', async () => {
    const list = await renderList(['a', 'b', 'c']);
    await list.row('b').focus();

    await list.remove('b');
    expect(list.focused()).toEqual(['c']);
    expect(list.row('c').view.focus).toHaveBeenCalledTimes(1);
  });

  it('hands focus to the row before when the last row leaves', async () => {
    const list = await renderList(['a', 'b', 'c']);
    await list.row('c').focus();

    await list.remove('c');
    expect(list.focused()).toEqual(['b']);
  });

  it('hands focus to the fallback when the only row leaves', async () => {
    const fallback = { current: { focus: jest.fn() } };
    const list = await renderList(['a'], { fallback });
    await list.row('a').focus();

    await list.remove('a');
    expect(fallback.current.focus).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the list empties and there is no fallback', async () => {
    const empty: { current: FocusTarget | null } = { current: null };
    const list = await renderList(['a'], { fallback: empty });
    await list.row('a').focus();

    await expect(list.remove('a')).resolves.not.toThrow();
  });

  it('moves no focus when the row that leaves did not hold it', async () => {
    const fallback = { current: { focus: jest.fn() } };
    const list = await renderList(['a', 'b', 'c'], { fallback });
    await list.row('a').focus();

    await list.remove('b');
    expect(list.focused()).toEqual([]);
    expect(fallback.current.focus).not.toHaveBeenCalled();
  });

  it('moves no focus when nothing held it, as after a touch', async () => {
    const fallback = { current: { focus: jest.fn() } };
    const list = await renderList(['a', 'b', 'c'], { fallback });
    await list.row('b').focus();
    // Touching the screen takes the window into touch mode, which blurs.
    await list.row('b').blur();

    await list.remove('b');
    expect(list.focused()).toEqual([]);
    expect(fallback.current.focus).not.toHaveBeenCalled();
  });

  it('passes over an heir that left in the same commit', async () => {
    const list = await renderList(['a', 'b', 'c', 'd']);
    await list.row('b').focus();

    await list.remove('b', 'c');
    expect(list.focused()).toEqual(['d']);
  });

  it('passes over an heir that is listed and not mounted', async () => {
    const list = await renderList(['a', 'b', 'c']);
    // Scrolled out of a virtualized list: still a key, no longer a view.
    await list.detach('c');
    await list.row('b').focus();

    await list.remove('b');
    expect(list.focused()).toEqual(['a']);
  });

  it('moves no focus when the focused control is replaced and its row stays', async () => {
    const list = await renderList(['a', 'b', 'c']);
    await list.row('b').focus();

    await list.detach('b');
    expect(list.focused()).toEqual([]);
  });

  it('hands focus on once per row that leaves', async () => {
    const list = await renderList(['a', 'b', 'c']);
    await list.row('b').focus();
    await list.remove('b');

    // The heir never said it took focus; a later render owes nothing.
    await list.setOptions({});
    await list.remove('a');
    expect(list.row('c').view.focus).toHaveBeenCalledTimes(1);
  });

  describe('while the list is not ready', () => {
    it('waits, and hands focus on when it is', async () => {
      const list = await renderList(['a', 'b', 'c'], { ready: false });
      await list.row('b').focus();

      await list.remove('b');
      expect(list.focused()).toEqual([]);

      // The render that makes it ready has not reached the views yet.
      await list.setOptions({ ready: true });
      expect(list.focused()).toEqual([]);
      await nextFrame();
      expect(list.focused()).toEqual(['c']);
    });

    it('gives the focus up when another control has taken it since', async () => {
      const list = await renderList(['a', 'b', 'c'], { ready: false });
      await list.row('b').focus();
      await list.remove('b');
      // Tab, while the save was still running.
      const elsewhere = await renderControl();
      await elsewhere.focus();

      await list.setOptions({ ready: true });
      await nextFrame();
      expect(list.focused()).toEqual([]);
      await elsewhere.blur();
    });

    it('hands focus to the heir still mounted when it is ready', async () => {
      const list = await renderList(['a', 'b', 'c'], { ready: false });
      await list.row('b').focus();
      await list.remove('b');
      await list.remove('c');

      await list.setOptions({ ready: true });
      await nextFrame();
      expect(list.focused()).toEqual(['a']);
    });

    it('gives the focus up when another control takes it in that frame', async () => {
      const list = await renderList(['a', 'b', 'c'], { ready: false });
      await list.row('b').focus();
      await list.remove('b');
      const elsewhere = await renderControl();
      await list.setOptions({ ready: true });
      await elsewhere.focus();

      await nextFrame();
      expect(list.focused()).toEqual([]);
      await elsewhere.blur();
    });

    it('asks for nothing once the list has unmounted', async () => {
      const list = await renderList(['a', 'b', 'c'], { ready: false });
      await list.row('b').focus();
      await list.remove('b');
      await list.setOptions({ ready: true });

      await list.unmount();
      await nextFrame();
      expect(list.focused()).toEqual([]);
    });
  });
});
