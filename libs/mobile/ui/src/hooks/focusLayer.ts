import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

/**
 * One window's worth of controls: the screen, or one open sheet.
 *
 * A sheet is a `Modal`, and on Android a `Modal` is a dialog in a window of
 * its own. Each window there keeps its own focused view, and a window that is
 * no longer the one taking keys does not blur the view it had: the first Tab
 * after a sheet opens by touch takes every window out of touch mode at once,
 * so the screen behind hands focus to its first control — the header's Lock
 * action — in the same instant the sheet focuses its own. That control is
 * never sent a blur while the sheet is up, because in its own window nothing
 * took focus from it. React Native reports a view's focus and not its
 * window's, so which window is in front is tracked here instead.
 */
export interface FocusLayer {
  /** How many sheets this one is rendered inside. */
  readonly depth: number;
}

/** The layer a control sits in. `null` is the screen itself. */
export const FocusLayerContext = createContext<FocusLayer | null>(null);

/** Open sheets, in the order they opened. */
let openLayers: readonly FocusLayer[] = [];
let front: FocusLayer | null = null;
const listeners = new Set<() => void>();

function setOpenLayers(next: readonly FocusLayer[]): void {
  openLayers = next;
  // A sheet rendered inside another presents over it; between two that are
  // not nested, the later one to open does. Depth is compared rather than
  // trusting the order alone because a sheet and one inside it that open in
  // the same commit register child first.
  front = next.reduce<FocusLayer | null>(
    (best, layer) =>
      best === null || layer.depth >= best.depth ? layer : best,
    null,
  );
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function frontLayer(): FocusLayer | null {
  return front;
}

/**
 * Declares a sheet's layer, in front of everything else while `open`.
 * Its content reaches it through `FocusLayerContext`.
 */
export function useFocusLayer(open: boolean): FocusLayer {
  const parent = useContext(FocusLayerContext);
  const depth = parent === null ? 0 : parent.depth + 1;
  const layer = useMemo<FocusLayer>(() => ({ depth }), [depth]);
  useEffect(() => {
    if (!open) return undefined;
    setOpenLayers([...openLayers, layer]);
    return () => setOpenLayers(openLayers.filter((other) => other !== layer));
  }, [open, layer]);
  return layer;
}

/** Whether the calling control's layer is the one in front. */
export function useInFrontFocusLayer(): boolean {
  const layer = useContext(FocusLayerContext);
  return layer === useSyncExternalStore(subscribe, frontLayer, frontLayer);
}
