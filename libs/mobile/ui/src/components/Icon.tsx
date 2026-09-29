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
  | 'saving'
  | 'biometric'
  | 'plus'
  | 'more'
  | 'archive'
  | 'copy'
  | 'mapPin'
  | 'share';

/**
 * A rounded rectangle as a path, so the glyph table stays one shape: every
 * glyph is a list of stroked paths, and a design drawn with `<rect>` and
 * `<circle>` is converted here rather than growing a second drawing path.
 */
function rect(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

/** A circle as a path, drawn as two half-arcs. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/** One stroke of a glyph. A faded stroke is the track under a spinner arc. */
type Stroke = string | { d: string; opacity: number };

/**
 * The glyphs, as stroked paths on a 24-unit grid — traced from the approved
 * design sheets wherever a sheet draws the glyph, so an icon on a device is
 * the icon the design shows rather than a look-alike.
 *
 * Drawn here rather than pulled from an icon package: the web app's icon
 * library is a DOM component set and does not render on a device, and one more
 * native dependency for a few dozen outlines is a worse trade than the
 * outlines. Every glyph is stroke-only and inherits the caller's colour, so an
 * icon is themed by the same Semantic Roles as the text beside it.
 *
 * Pinned to the name set: a name with no drawing fails here rather than
 * rendering as an empty square on a device.
 */
const PATHS = {
  // A trolley, as the Navigation sheet's Groceries tab draws it.
  groceries: [
    'M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2',
    circle(10, 20, 1.3),
    circle(17, 20, 1.3),
  ],
  tasks: [rect(4, 4, 16, 16, 3), 'M8.5 12l2.5 2.5 4.5-5'],
  // Two arrows chasing each other: something that comes round again.
  subscriptions: [
    'M4 12a8 8 0 0 1 13.7-5.6L20 8.5',
    'M20 4v4.5h-4.5',
    'M20 12a8 8 0 0 1-13.7 5.6L4 15.5',
    'M4 20v-4.5h4.5',
  ],
  details: [
    rect(3, 5, 18, 14, 2),
    circle(9, 11, 2),
    'M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2',
    'M15 10h3',
    'M15 14h3',
  ],
  account: [
    circle(12, 12, 9),
    circle(12, 10, 3),
    'M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3',
  ],
  lock: [rect(5, 11, 14, 10, 2), 'M8 11V7a4 4 0 0 1 8 0v4'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  close: ['M6 6 18 18', 'M18 6 6 18'],
  error: [
    'M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z',
    'M12 7.5v5.5',
    'M12 16.3v.2',
  ],
  warning: ['M12 3.5L2.5 20h19L12 3.5z', 'M12 10v4.5', 'M12 17.5v.01'],
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
  // Counter-clockwise, as the Lists sheet's Retry and Reload draw it.
  retry: ['M4 12a8 8 0 1 0 2.4-5.7L4 8.5', 'M4 4v4.5h4.5'],
  // A quarter arc over a faded track — the Unconfirmed row's "Saving…".
  saving: [{ d: circle(12, 12, 9), opacity: 0.25 }, 'M21 12a9 9 0 0 0-9-9'],
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
  // A storage box, as the Lists sheet's Archive swipe action draws it.
  archive: [
    'M3 4h18v4H3z',
    'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8',
    'M10 12h4',
  ],
  // Two overlapping rects: the back sheet peeking out is what reads as "a copy
  // of something" rather than as a second, unrelated square.
  copy: ['M9.5 9.5h10v11h-10z', 'M6.5 14.5v-9a1 1 0 0 1 1-1h9'],
  // A teardrop with a hollow centre — the map-pin silhouette every mapping app
  // uses, so "Open in Maps" reads as a place rather than a generic marker.
  mapPin: [
    'M12 21c4-4.6 7-8.3 7-11.8A7 7 0 0 0 5 9.2C5 12.7 8 16.4 12 21z',
    'M12 12a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
  ],
  // An arrow lifting out of an open tray — the platform-neutral "send this
  // elsewhere" glyph, distinct from `plus` and from a download-shaped arrow.
  share: [
    'M12 15V4.5',
    'M8 8.5 12 4.5 16 8.5',
    'M5.5 13v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-6',
  ],
} as const satisfies Record<IconName, readonly Stroke[]>;

/** The stroke weight the design sheets draw nearly every glyph at. */
const DEFAULT_STROKE_WIDTH = 2;

export interface IconProps {
  name: IconName;
  /** Side length in points. The glyphs are drawn square. */
  size?: number;
  /** A Semantic Role to draw this glyph in. Defaults to the body colour. */
  color?: keyof ThemeColors;
  /**
   * Stroke weight on the 24-unit grid. 2 by default, as the sheets draw it;
   * the active tab draws 2.4 and a checkbox tick 3.
   */
  strokeWidth?: number;
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
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: IconProps): React.JSX.Element {
  const theme = useTheme();
  const strokes: readonly Stroke[] = PATHS[name];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {strokes.map((stroke) => {
        const d = typeof stroke === 'string' ? stroke : stroke.d;
        return (
          <Path
            key={d}
            d={d}
            stroke={theme.colors[color]}
            strokeOpacity={typeof stroke === 'string' ? 1 : stroke.opacity}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
}
