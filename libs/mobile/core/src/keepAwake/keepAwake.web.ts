// Web variant of ./keepAwake, selected by the Vite `resolve.extensions` list
// in apps/mobile/vite.config.mts ('.web.ts' precedes '.ts'). The web target is
// the react-native-web preview of this app, which has no screen timeout of
// its own to hold off, so the counter drives nothing.
import { createKeepAwakeCounter } from './keepAwakeCounter';

export const keepAwake = createKeepAwakeCounter({
  activate: () => undefined,
  deactivate: () => undefined,
});
