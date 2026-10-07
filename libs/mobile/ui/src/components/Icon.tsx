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
  | 'share'
  | 'phone'
  | 'faceId'
  | 'fingerprint'
  | 'timer'
  | 'sun'
  | 'globe'
  | 'shield'
  | 'document'
  | 'external'
  | 'logout'
  | 'chevronLeft'
  | 'mail'
  | 'trash'
  | 'pencil'
  | 'search'
  | 'tag'
  | 'undo'
  | 'listRemove'
  | 'calendar'
  | 'arrowUp'
  | 'arrowLeft'
  | 'home'
  | 'call'
  | 'person'
  | 'government'
  | 'healthcare'
  | 'bank'
  | 'briefcase'
  | 'bolt'
  | 'graduation';

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
  // The glyphs below are traced from the Account sheet (6 · Account).
  // A handset: "this phone" — a setting that belongs to this device.
  phone: [rect(7, 2, 10, 20, 2), 'M11 18h2'],
  // Face ID's own mark, for a row that names Face ID. The neutral
  // `biometric` mark stays for a control that may raise either method.
  faceId: [
    'M4 8V6a2 2 0 0 1 2-2h2',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M20 16v2a2 2 0 0 1-2 2h-2',
    'M8 20H6a2 2 0 0 1-2-2v-2',
    'M9 9v1.5',
    'M15 9v1.5',
    'M12 9v4h-1',
    'M9 15.5c1.6 1.3 4.4 1.3 6 0',
  ],
  fingerprint: [
    'M12 11v3a8 8 0 0 1-1.5 4.5',
    'M8.5 12a3.5 3.5 0 0 1 7 0v1.5a13 13 0 0 1-.8 4.5',
    'M5.5 15.5a14 14 0 0 0 .5-3.5 6 6 0 0 1 11-3.3',
    'M18.8 11.5c.1.6.2 1.3.2 2a18 18 0 0 1-.4 3.5',
    'M4 9.5A8.5 8.5 0 0 1 17.5 4.8',
  ],
  // A stopwatch: Auto-lock.
  timer: [circle(12, 13, 8), 'M12 9v4l2 2', 'M9 2h6'],
  // A sun: keep the screen awake.
  sun: [
    circle(12, 12, 4),
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  globe: [
    circle(12, 12, 9),
    'M3 12h18',
    'M12 3a14 14 0 0 1 0 18',
    'M12 3a14 14 0 0 0 0 18',
  ],
  shield: ['M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z'],
  document: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  // A box with an arrow leaving it: the row opens outside the app.
  external: [
    'M14 4h6v6',
    'M20 4l-9 9',
    'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  ],
  logout: [
    'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3',
    'M10 16l-4-4 4-4',
    'M6 12h10',
  ],
  // The in-screen back link ("‹ Sign in", "‹ Unlock") on the Entry sheets,
  // which draw it at 2.4.
  chevronLeft: ['M15 5l-7 7 7 7'],
  // An envelope — Forgot password's "Check your email" (Entry sheets).
  mail: [rect(3, 5, 18, 14, 2), 'M3.5 6.5l8.5 6.5 8.5-6.5'],
  // The glyphs below are traced from the Groceries sheet (2 · Groceries).
  // A bin: Delete — a list, or a line from one.
  trash: [
    'M4 7h16',
    'M10 11v6',
    'M14 11v6',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
    'M9 7V4h6v3',
  ],
  // A pencil: Rename list.
  pencil: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  // A magnifier: the Add sheet's "Search your Catalog" field.
  search: [circle(11, 11, 7), 'M20 20l-3.5-3.5'],
  // A price tag: an unselected category chip on the Create sheet.
  tag: ['M3 12V4h8l10 10-8 8L3 12z', circle(7.5, 7.5, 1.3)],
  // An arrow turning back: Uncheck All.
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  // Lines with a cross: Remove Checked From List.
  listRemove: ['M4 6h10', 'M4 12h10', 'M4 18h6', 'M16 16l5 5', 'M21 16l-5 5'],
  // The glyphs below are traced from the Tasks sheet (3 · Tasks).
  // A calendar page: the capture composer's Today / Tomorrow / Pick date.
  calendar: [rect(4, 5, 16, 16, 2), 'M4 10h16', 'M9 3v4', 'M15 3v4'],
  // An arrow rising: the capture composer's round Save.
  arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
  // An arrow pointing back: the way out of a pushed screen on Android.
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  // The glyphs below are traced from the Details sheet (5 · Details).
  // A house: an Address, and the Housing Organisation Type.
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10'],
  // A handset receiver: a Usage Location updated "By phone", and Telecom.
  call: [
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  ],
  // A person: a Usage Location updated "In person". Not drawn on the sheet,
  // which shows only Online and By phone; built on `account`'s figure.
  person: [circle(12, 8, 3.5), 'M5.5 20c1.2-3.3 3.6-5 6.5-5s5.3 1.7 6.5 5'],
  // The Organisation Type tiles on Det-UL.
  government: [
    'M3 21h18',
    'M4 10h16',
    'M12 3l8 5H4l8-5z',
    'M6 10v8',
    'M10 10v8',
    'M14 10v8',
    'M18 10v8',
  ],
  healthcare: ['M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z'],
  bank: [rect(3, 6, 18, 13, 2), 'M3 10h18', 'M7 15h3'],
  briefcase: [rect(3, 7, 18, 13, 2), 'M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
  // A mortarboard: School and University. Not drawn on the sheet.
  graduation: ['M2 9l10-5 10 5-10 5-10-5z', 'M6 11v5c3.5 2.5 8.5 2.5 12 0v-5'],
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
