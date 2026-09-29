import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../useTheme';
import type { ThemeColors } from '../theme';

/** Every glyph this app draws. */
export type IconName =
  | 'groceries'
  | 'tasks'
  | 'subscriptions'
  | 'details'
  | 'account'
  | 'lock'
  | 'chevronDown'
  | 'chevronRight'
  | 'check'
  | 'close'
  | 'error'
  | 'warning'
  | 'info'
  | 'offline'
  | 'retry'
  | 'biometric'
  | 'plus'
  | 'more'
  | 'archive';

/**
 * The glyphs, as stroked paths on a 24-unit grid.
 *
 * Drawn here rather than pulled from an icon package: the web app's icon
 * library is a DOM component set and does not render on a device, and one more
 * native dependency for fifteen outlines is a worse trade than the outlines.
 * Every glyph is stroke-only and inherits the caller's colour, so an icon is
 * themed by the same Semantic Roles as the text beside it.
 *
 * Pinned to the name set: a name with no drawing fails here rather than
 * rendering as an empty square on a device.
 */
const PATHS = {
  groceries: [
    'M4 9h16l-1.6 10.6a2 2 0 0 1-2 1.4H7.6a2 2 0 0 1-2-1.4L4 9z',
    'M8.5 9 11 3.5',
    'M15.5 9 13 3.5',
  ],
  tasks: ['M4 7h10', 'M4 12h7', 'M4 17h5', 'M14.5 16 17 18.5 21.5 13'],
  subscriptions: [
    'M3 6.5h18v11H3z',
    'M3 10.5h18',
    'M6.5 14.5h4',
    'M17 3.5l2 2-2 2',
  ],
  details: [
    'M3 5h18v14H3z',
    'M8.5 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M5.8 16c.7-1.7 1.9-2.6 2.7-2.6s2 .9 2.7 2.6',
    'M14 9.5h4.5',
    'M14 13.5h4.5',
  ],
  account: [
    'M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z',
    'M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.2 19c1.1-2.3 3.3-3.6 5.8-3.6s4.7 1.3 5.8 3.6',
  ],
  lock: ['M5.5 10.5h13v10h-13z', 'M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3'],
  chevronDown: ['M6 9.5 12 15.5 18 9.5'],
  chevronRight: ['M9.5 6 15.5 12 9.5 18'],
  check: ['M5 12.5 10 17.5 19 7'],
  close: ['M6 6 18 18', 'M18 6 6 18'],
  error: [
    'M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z',
    'M12 7.5v5.5',
    'M12 16.3v.2',
  ],
  warning: ['M12 3.5 22.5 20.5h-21z', 'M12 10v4.5', 'M12 17.6v.2'],
  info: [
    'M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z',
    'M12 11v5.5',
    'M12 7.7v.2',
  ],
  offline: [
    'M7 18.5h9.5a3.5 3.5 0 0 0 .4-7 5.2 5.2 0 0 0-8-3.2',
    'M6.4 10.2A3.9 3.9 0 0 0 7 18.5',
    'M3.5 3.5 20.5 20.5',
  ],
  retry: ['M20 12a8 8 0 1 1-2.5-5.8', 'M20 4v4.5h-4.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  // Three round-capped, zero-length strokes: the standard way to draw a dot
  // in a stroke-only icon set without a second, fill-based drawing path.
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  // The platform-neutral face-and-frame mark, not a fingerprint and not a
  // Face ID glyph: the same button raises Face ID on one device and a
  // fingerprint on another, and a button drawn as the wrong one of the two is
  // read as the wrong control rather than as a generic one.
  biometric: [
    'M3.5 8.5v-2a3 3 0 0 1 3-3h2',
    'M15.5 3.5h2a3 3 0 0 1 3 3v2',
    'M20.5 15.5v2a3 3 0 0 1-3 3h-2',
    'M8.5 20.5h-2a3 3 0 0 1-3-3v-2',
    'M9 10v1.5',
    'M15 10v1.5',
    'M9 15.2c.8.8 1.8 1.3 3 1.3s2.2-.5 3-1.3',
  ],
  // A storage box: the lid as a separate stroke from the box it sits on, so
  // the glyph reads as "put away" rather than as the plain box `subscriptions`
  // already draws.
  archive: [
    'M4 7h16v3.5H4z',
    'M6 10.5v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8',
    'M10 14h4',
  ],
} as const satisfies Record<IconName, readonly string[]>;

export interface IconProps {
  name: IconName;
  /** Side length in points. The glyphs are drawn square. */
  size?: number;
  /** A Semantic Role to draw this glyph in. Defaults to the body colour. */
  color?: keyof ThemeColors;
}

/**
 * A glyph. Always decorative — it carries no accessibility label of its own,
 * because an icon that labels itself reads out twice next to the text it sits
 * beside. A control wraps it and carries the label.
 */
export function Icon({
  name,
  size = 24,
  color = 'foreground',
}: IconProps): React.JSX.Element {
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
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
