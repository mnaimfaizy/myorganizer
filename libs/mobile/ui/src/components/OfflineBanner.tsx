import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { useIsOffline } from '../hooks/useIsOffline';
import { staticElement } from '../staticElement';
import type { ThemeColors } from '../theme';
import { Glyph, type GlyphName } from './glyphs';
import { Text } from './Text';

/** How long "Back online" stays before the strip collapses (Overlays sheet). */
const BACK_ONLINE_MS = 2000;

/** The strip's height on the Overlays sheet. No token carries it. */
const BANNER_HEIGHT = 40;

/** What the strip is saying. */
type BannerState = 'offline' | 'reconnecting' | 'backOnline';

/**
 * Each state's fill, copy and mark, pinned to the state set.
 *
 * Offline is a warning, not an error: nothing has failed yet — but the app is
 * online-only (ADR 0107), so an edit made now cannot be saved, and the strip
 * says exactly that rather than promising to sync later.
 */
const STATES = {
  offline: {
    fill: 'warning',
    text: 'warningForeground',
    mark: 'wifiOff',
    message: 'You’re offline — changes can’t be saved',
  },
  reconnecting: {
    fill: 'warning',
    text: 'warningForeground',
    mark: 'spinner',
    message: 'Reconnecting…',
  },
  backOnline: {
    fill: 'success',
    text: 'successForeground',
    mark: 'wifi',
    message: 'Back online',
  },
} as const satisfies Record<
  BannerState,
  {
    fill: keyof ThemeColors;
    text: keyof ThemeColors;
    mark: GlyphName | 'spinner';
    message: string;
  }
>;

export interface OfflineBannerProps {
  /**
   * Overrides the device's own answer. Present so a screen can render the
   * banner deliberately; left alone, the banner asks the device.
   */
  offline?: boolean;
  /**
   * The screen is retrying its connection — shows "Reconnecting…" in place of
   * the offline line. The device reports only whether it is offline, so this
   * one comes from whoever is doing the retrying.
   */
  reconnecting?: boolean;
  style?: ViewStyle;
}

/**
 * A full-width strip pinned under the header while the device has no usable
 * connection. It pushes the content down and never covers it.
 *
 * When the connection comes back it turns to "Back online" for two seconds,
 * then collapses — so the User sees the edit block lift, rather than the
 * warning just disappearing. It appears and goes without travelling, so there
 * is no motion for Reduce Motion to take.
 */
export function OfflineBanner({
  offline,
  reconnecting = false,
  style,
}: OfflineBannerProps): React.JSX.Element | null {
  const theme = useTheme();
  const deviceOffline = useIsOffline();
  const down = (offline ?? deviceOffline) || reconnecting;
  const [backOnline, setBackOnline] = useState(false);
  const wasDown = useRef(down);

  useEffect(() => {
    const cameBack = wasDown.current && !down;
    wasDown.current = down;
    if (!cameBack) {
      if (down) setBackOnline(false);
      return undefined;
    }
    setBackOnline(true);
    const timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
    return () => clearTimeout(timer);
  }, [down]);

  const state: BannerState | null = reconnecting
    ? 'reconnecting'
    : down
      ? 'offline'
      : backOnline
        ? 'backOnline'
        : null;
  if (state === null) return null;

  const { fill, text, mark, message } = STATES[state];

  return (
    <View
      {...staticElement()}
      accessibilityRole="text"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={[
        styles.strip,
        {
          minHeight: BANNER_HEIGHT,
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors[fill],
        },
        style,
      ]}
    >
      {mark === 'spinner' ? (
        // Android's spinner is a screen reader stop of its own ("in
        // progress") unless what holds it hides it.
        <View importantForAccessibility="no-hide-descendants">
          <ActivityIndicator size="small" color={theme.colors[text]} />
        </View>
      ) : (
        <Glyph name={mark} size={18} color={text} />
      )}
      <Text
        importantForAccessibility="no"
        variant="bodySm"
        weight="semibold"
        color={text}
        style={styles.message}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flexShrink: 1,
  },
});
