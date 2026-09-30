import React, { useLayoutEffect, useRef } from 'react';
import { useAutoLockDelay, shouldAutoLock } from '@myorganizer/mobile/core';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import { PrivacyCover, useAppState } from '@myorganizer/mobile/ui';

interface AppLockGateProps {
  children: React.ReactNode;
}

/**
 * The two things the app does to itself when it stops being looked at
 * (ADR 0108 decision 6): it covers its content, and after the Auto-Lock Delay
 * in the background it locks the Vault.
 *
 * They are separate rules and deliberately not one. The cover goes up the
 * moment the app stops being frontmost — including `inactive`, which is a
 * system prompt or the app switcher being raised over it — while the lock
 * clock only starts on `background`. Locking on `inactive` would drop the
 * Master Key behind a permission dialog the User answered in two seconds.
 *
 * The decision itself is `shouldAutoLock`, a pure function of when the app
 * left, what time it is, and the setting. Nothing here runs a timer: a timer
 * scheduled for five minutes' time is a timer the OS is free not to fire while
 * the app is suspended, and the answer is wanted exactly once — on the way
 * back in.
 *
 * It is a layout effect, which is the one place that choice is not a matter of
 * taste: the render that sets `AppState` to `active` is also the render that
 * takes the cover down, and a passive effect runs after that render has been
 * painted. The Vault's contents would be on screen for a frame before the lock
 * landed. A layout effect locks first, so the frame that is drawn is already
 * the Unlock screen.
 */
export function AppLockGate({ children }: AppLockGateProps): React.JSX.Element {
  const appState = useAppState();
  const delay = useAutoLockDelay();
  const { status, lock } = useVaultSession();

  // A ref rather than state: writing it must not re-render the whole app, and
  // nothing renders from it. `null` means the app has not been away since the
  // last time this was read.
  const backgroundedAt = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (appState === 'background') {
      backgroundedAt.current ??= Date.now();
      return;
    }
    if (appState !== 'active') return;

    // Read and cleared together, so one return to the foreground is one
    // decision — a second `active` with no `background` between them is the
    // app never having left.
    const leftAt = backgroundedAt.current;
    backgroundedAt.current = null;

    if (status !== 'unlocked') return;
    if (shouldAutoLock({ backgroundedAt: leftAt, now: Date.now(), delay })) {
      lock('auto-lock');
    }
  }, [appState, delay, status, lock]);

  return (
    <>
      {children}
      {/* Named positively rather than as `!== 'active'`: `AppState` also
          reports `unknown`, which Android can hand back before the activity
          has resumed, and covering an app that is merely still starting up is
          a cover over the launch. */}
      <PrivacyCover
        visible={appState === 'background' || appState === 'inactive'}
      />
    </>
  );
}
