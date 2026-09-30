import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../useTheme';
import type { ThemeColors } from '../theme';

/**
 * The glyphs the Foundation sheets draw for the controls in this set that the
 * shared `Icon` set does not carry yet: the reveal toggle's eye and struck eye
 * (Inputs sheet) and the OfflineBanner's Wi-Fi marks (Overlays sheet).
 *
 * Kept internal and drawn exactly as `Icon` draws — stroke-only, on the same
 * 24-unit grid, at the same stroke width, in a Semantic Role — so moving them
 * into `Icon` later is a cut and paste, not a redraw. They are not exported:
 * a screen that needs one of these should get it from `Icon` once it is there.
 */
export type GlyphName = 'eye' | 'eyeOff' | 'wifi' | 'wifiOff';

const PATHS = {
  eye: [
    'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  eyeOff: [
    'M3 3l18 18',
    'M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4',
    'M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  wifi: [
    'M8.5 16.5a5 5 0 0 1 7 0',
    'M5 12.9a10 10 0 0 1 14 0',
    'M2 9a15 15 0 0 1 20 0',
    'M12 20h.01',
  ],
  wifiOff: [
    'M3 3l18 18',
    'M8.5 16.5a5 5 0 0 1 7 0',
    'M5 12.9a10 10 0 0 1 4.2-2.4',
    'M19 12.9a10 10 0 0 0-3-2',
    'M2 9a15 15 0 0 1 4.5-2.8',
    'M22 9a15 15 0 0 0-11-3.9',
    'M12 20h.01',
  ],
} as const satisfies Record<GlyphName, readonly string[]>;

export function Glyph({
  name,
  size = 24,
  color = 'foreground',
}: {
  name: GlyphName;
  size?: number;
  color?: keyof ThemeColors;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={theme.colors[color]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
