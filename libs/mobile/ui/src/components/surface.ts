import { createContext, useContext } from 'react';

/**
 * What a control is sitting on.
 *
 * In dark mode a sheet takes the raised `muted` surface (P6), which is the
 * very colour a `secondary` fill resolves to — so a secondary button drawn on a
 * sheet would vanish into it. The design draws that button in `accent` there
 * instead. `BottomSheet` says it is a sheet through this context, and `Button`
 * reads it, so no screen has to remember which surface it put a button on.
 */
export type Surface = 'page' | 'sheet';

export const SurfaceContext = createContext<Surface>('page');

export function useSurface(): Surface {
  return useContext(SurfaceContext);
}
