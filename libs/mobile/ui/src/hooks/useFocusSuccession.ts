import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';
import {
  keyboardFocusedView,
  nameSuccessor,
  type FocusTarget,
} from './focusReturn';

/**
 * Who takes focus when the item at `departed` leaves `order`, nearest first:
 * every item after it, then every item before it, walking back. Empty when
 * `departed` was not in `order`.
 */
export function focusHeirs<K>(order: readonly K[], departed: K): K[] {
  const at = order.indexOf(departed);
  if (at < 0) return [];
  return [...order.slice(at + 1), ...order.slice(0, at).reverse()];
}

export interface FocusSuccessionOptions {
  /**
   * Takes focus when no item is left to — the list emptied, or none of the
   * heirs is mounted.
   */
  fallback?: RefObject<FocusTarget | null>;
  /**
   * `false` while the list's controls cannot take focus — disabled for the
   * length of a save, say. A focus owed in that time is handed over when this
   * turns `true`, unless the User has moved to another control since.
   */
  ready?: boolean;
}

/** The focus a departed item left owing. */
interface Debt<K> {
  heirs: readonly K[];
  /** The view that left, which may still be noted as holding focus. */
  from: FocusTarget;
}

/**
 * Hands keyboard focus on when the list item holding it leaves the list
 * (#1068). `keys` names the items in the order they are drawn; the function
 * returned gives each item's control its `ref`.
 *
 * Android does not do this itself. When the focused view is removed outside
 * touch mode the window focuses the first focusable view it holds, which is
 * the inert `FocusLanding`: safe, and at the top of the screen. A User ticking
 * Tasks off by keyboard was sent back there after every one.
 *
 * So when an item's control is unmounted while it is the control noted as
 * holding focus (`focusReturn.ts`) and its key has left `keys`, focus goes to
 * the item that takes its place: the next one that is still in the list and
 * mounted, else the nearest before it, else `fallback`. A virtualized list's
 * heir may not be mounted; it is passed over, never waited for.
 *
 * Only a keyboard gets here. Nothing is noted after a touch, so an item
 * removed by touch hands nothing on and no ring appears; and Android refuses
 * a focus request in touch mode. iOS notes no control at all (#1021).
 *
 * Focus is requested in a layout effect, before the removed control's own
 * `useFocusRing` has cleaned up, which is why the view that left may still be
 * the one noted; any other control noted by then is where the User has moved
 * to, and keeps focus. A focus that waited for `ready` is requested a frame
 * after the render that brought it.
 *
 * A screen opened from an item returns focus to it on leaving
 * (`useReturnFocusOnLeave`). When the item is gone by then — deleted on the
 * screen it opened — the same order answers: each control is named a
 * successor (`nameSuccessor`), which is the item's own control if it has been
 * mounted again somewhere else in the list, else the heir as above (#1075).
 * It is worked out when it is asked for, against the items mounted then, so
 * an heir that has left since is passed over too.
 *
 * The row must still have a size when it is removed. Android takes focus from
 * a view that shrinks to nothing before React is told, and then no control
 * is noted as the row leaves (see `LEAVE_FLOOR` in `ListRow.tsx`).
 */
export function useFocusSuccession<K>(
  keys: readonly K[],
  { fallback, ready = true }: FocusSuccessionOptions = {},
): (key: K) => (view: FocusTarget | null) => void {
  const views = useRef(new Map<K, FocusTarget>());
  const refs = useRef(new Map<K, (view: FocusTarget | null) => void>());
  const order = useRef(keys);
  // The item whose control was unmounted holding focus, until the layout
  // effect of the same commit has read it.
  const departed = useRef<{ key: K; view: FocusTarget } | null>(null);
  const owed = useRef<Debt<K> | null>(null);
  // Every control unmounted in the commit under way, focused or not.
  const detached = useRef<{ key: K; view: FocusTarget }[]>([]);
  // The heirs of each control whose item has left, for as long as something
  // else still holds the control's view.
  const heirsOfGone = useRef(new WeakMap<FocusTarget, readonly K[]>());
  const fallbackNow = useRef(fallback);
  const readyBefore = useRef(ready);
  const frame = useRef(0);

  const refFor = useCallback((key: K) => {
    const known = refs.current.get(key);
    if (known !== undefined) return known;
    // One function per key for as long as the key is listed: React detaches
    // and reattaches a ref whose function changes, and a detach is read here
    // as the control leaving.
    const ref = (view: FocusTarget | null): void => {
      if (view !== null) {
        views.current.set(key, view);
        nameSuccessor(view, () => {
          const again = views.current.get(key);
          if (again !== undefined) return again;
          const heirs = heirsOfGone.current.get(view);
          // Still listed and not mounted: there is no place to take.
          if (heirs === undefined) return null;
          const heir = heirs.find((other) => views.current.has(other));
          return heir !== undefined
            ? (views.current.get(heir) ?? null)
            : (fallbackNow.current?.current ?? null);
        });
        return;
      }
      const was = views.current.get(key);
      views.current.delete(key);
      if (was === undefined) return;
      detached.current.push({ key, view: was });
      if (keyboardFocusedView() === was) {
        departed.current = { key, view: was };
      }
    };
    refs.current.set(key, ref);
    return ref;
  }, []);

  useLayoutEffect(() => {
    const listed = new Set(keys);
    const left = departed.current;
    departed.current = null;
    // Still listed: the control was replaced, and its item did not leave.
    if (left !== null && !listed.has(left.key)) {
      owed.current = {
        heirs: focusHeirs(order.current, left.key),
        from: left.view,
      };
    }
    for (const gone of detached.current) {
      if (!listed.has(gone.key)) {
        heirsOfGone.current.set(gone.view, focusHeirs(order.current, gone.key));
      }
    }
    detached.current = [];
    fallbackNow.current = fallback;
    order.current = keys;
    for (const key of refs.current.keys()) {
      if (!listed.has(key)) refs.current.delete(key);
    }

    const wasReady = readyBefore.current;
    readyBefore.current = ready;
    const debt = owed.current;
    if (debt === null || !ready) return;
    owed.current = null;
    const settle = (): void => {
      const holder = keyboardFocusedView();
      if (holder !== null && holder !== debt.from) return;
      const heir = debt.heirs.find((key) => views.current.has(key));
      const target =
        heir !== undefined ? views.current.get(heir) : fallback?.current;
      target?.focus();
    };
    if (wasReady) {
      settle();
      return;
    }
    // Ready as of this commit, which has not reached the views yet: Android
    // runs a focus request ahead of the commit it was sent beside, and the
    // heir it finds is still disabled. A frame on, the commit has landed.
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(settle);
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return refFor;
}
