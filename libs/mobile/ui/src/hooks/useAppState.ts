import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const APP_STATE_STATUSES = [
  'active',
  'inactive',
  'background',
  'extension',
  'unknown',
] as const satisfies readonly AppStateStatus[];

/**
 * `AppState.currentState` is typed as any string, and is `null` until the
 * native module has reported. Anything that is not a status reads as
 * `unknown`, which nothing here treats as foreground or as background.
 */
function readCurrentAppState(): AppStateStatus {
  const current = AppState.currentState;
  return APP_STATE_STATUSES.find((status) => status === current) ?? 'unknown';
}

/**
 * Whether this app is in the foreground, as the OS reports it.
 *
 * The three statuses are not three degrees of the same thing:
 *
 * - `active` — on screen and taking input.
 * - `inactive` — on screen but not taking input, which is iOS raising the app
 *   switcher, pulling down Control Centre, or showing a system prompt. It is
 *   also the moment iOS takes the snapshot it shows in the switcher, which is
 *   why the privacy cover goes up here and not one status later. Android does
 *   not report it.
 * - `background` — off screen. This is the one the Auto-Lock clock starts on,
 *   because a system permission dialog must not be able to lock the Vault
 *   behind itself.
 *
 * The initial value is read from `AppState.currentState` rather than assumed
 * `active`: a component mounted while the app is already backgrounded — a
 * remount after a lock, on Android — would otherwise render one frame of
 * uncovered content.
 */
export function useAppState(): AppStateStatus {
  const [state, setState] = useState<AppStateStatus>(readCurrentAppState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);

  return state;
}
