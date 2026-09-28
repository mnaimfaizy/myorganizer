import React from 'react';
import type { ViewStyle } from 'react-native';
import { useIsOffline } from '../hooks/useIsOffline';
import { InlineNotice } from './InlineNotice';

/** What the banner says. One line, and it says what still works. */
const MESSAGE = 'Offline — changes are saved on this device and sync later.';

export interface OfflineBannerProps {
  /**
   * Overrides the device's own answer. Present so a screen can render the
   * banner deliberately; left alone, the banner asks the device.
   */
  offline?: boolean;
  style?: ViewStyle;
}

/**
 * Shown while the device has no usable connection.
 *
 * It is a warning rather than an error because nothing has failed: this app
 * keeps working offline and pushes when it can, and the banner exists to say
 * so rather than to report a problem.
 */
export function OfflineBanner({
  offline,
  style,
}: OfflineBannerProps): React.JSX.Element | null {
  const deviceOffline = useIsOffline();
  if (!(offline ?? deviceOffline)) return null;

  return (
    <InlineNotice
      tone="warning"
      icon="offline"
      message={MESSAGE}
      style={style}
    />
  );
}
