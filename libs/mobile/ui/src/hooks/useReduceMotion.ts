import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the device is asking for reduced motion.
 *
 * Read as state rather than once at import, and subscribed to: the setting is
 * changed from Settings while the app is running, and a component that read it
 * at mount would keep animating for the rest of the session.
 *
 * Every animation in this library is gated on it. The rule is that motion is
 * the only thing that goes — a row still swipes, a sheet still opens, a
 * skeleton still marks the space; they arrive at their end state without
 * travelling there.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
