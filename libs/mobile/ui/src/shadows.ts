import type { ViewStyle } from 'react-native';
import { shadowCard, shadowPopover } from '@myorganizer/design-tokens';

/** The two elevations the token set carries, as React Native reads them. */
export type ShadowName = 'card' | 'popover';

/**
 * One elevation, in the shape a `StyleSheet` entry takes. iOS reads the four
 * `shadow*` properties; Android reads `elevation` and nothing else, so both
 * halves come out of the same token rather than one platform being styled and
 * the other left flat.
 */
export type Shadow = Required<
  Pick<
    ViewStyle,
    'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius'
  >
> &
  Required<Pick<ViewStyle, 'elevation'>>;

// `0` and `0px` both appear in the token set, so the unit is optional on
// every length; anything else about the form is not.
const LENGTH = String.raw`(-?[\d.]+)(?:px)?`;
const CSS_SHADOW = new RegExp(
  String.raw`^${LENGTH}\s+${LENGTH}\s+${LENGTH}\s+` +
    String.raw`rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$`,
);

/**
 * A CSS box-shadow token as a React Native shadow.
 *
 * Only the one form the token set uses is accepted — `<x> <y> <blur> rgba(…)`
 * — and anything else throws rather than being silently dropped. A shadow that
 * fails to parse would otherwise render as no shadow at all, which is exactly
 * the class of silent-miss the tokens gate exists to catch.
 *
 * `elevation` is half the blur radius, rounded. Android's elevation is a
 * single density-independent depth rather than an offset and a blur, and half
 * the blur is the conventional reading of one as the other; it is derived here
 * so a re-blurred token moves both platforms together.
 */
export function toRnShadow(token: string): Shadow {
  const match = CSS_SHADOW.exec(token.trim());
  if (match === null) {
    throw new Error(`Shadow token is not a usable box-shadow: ${token}`);
  }
  const [, x, y, blur, r, g, b, alpha] = match;
  return {
    shadowColor: `rgb(${r}, ${g}, ${b})`,
    shadowOffset: { width: Number(x), height: Number(y) },
    shadowOpacity: Number(alpha),
    shadowRadius: Number(blur),
    elevation: Math.round(Number(blur) / 2),
  };
}

/**
 * The elevations, converted once. Pinned to the name set in both directions:
 * a name with no token and a token for no name both fail here.
 */
export const shadows = {
  card: toRnShadow(shadowCard),
  popover: toRnShadow(shadowPopover),
} satisfies Record<ShadowName, Shadow>;
