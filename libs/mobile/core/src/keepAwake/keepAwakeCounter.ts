/** What the counter drives: the platform's keep-screen-on switch. */
export interface ScreenWake {
  activate(): void;
  deactivate(): void;
}

/**
 * Counts who wants the screen kept on, and flips the platform switch only on
 * the edges — the first request turns it on, the last release turns it off.
 *
 * Counted rather than toggled because more than one screen can ask at once
 * (a Grocery List pushed over another, a remount during navigation), and a
 * plain on/off lets whichever releases first switch it off under the other.
 * A release with nothing held is ignored rather than driving the count
 * negative, so a double release cannot leave the next request unable to
 * turn it on.
 */
export function createKeepAwakeCounter(wake: ScreenWake): {
  acquire(): () => void;
} {
  let holders = 0;

  return {
    acquire() {
      holders += 1;
      if (holders === 1) wake.activate();

      let released = false;
      return () => {
        if (released || holders === 0) return;
        released = true;
        holders -= 1;
        if (holders === 0) wake.deactivate();
      };
    },
  };
}
