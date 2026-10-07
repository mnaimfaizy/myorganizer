import React, { useId } from 'react';
import { Text as RNText, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { LinearGradient, Path, Stop } from 'react-native-svg';
import {
  colorOnSecondary,
  colorSecondary,
  colorTertiary,
} from '@myorganizer/design-tokens';
import { staticElement } from '../staticElement';
import { useTheme } from '../useTheme';
import { fontCutFor } from '../typeScale';
import { Text } from './Text';

/**
 * - `mark` — the shield alone (the Unlock screens' badge).
 * - `stacked` — the shield over the wordmark (the privacy cover).
 * - `inline` — the shield beside the wordmark (the Sign in header).
 */
export type BrandLockup = 'mark' | 'stacked' | 'inline';

/**
 * Each lockup's shield size and wordmark size, as the Entry sheets draw them.
 * The wordmark is logo art rather than running text, so it keeps its drawn
 * size (26/33 on the cover, 22/28 in the header) instead of taking the
 * nearest type step.
 */
const LOCKUPS = {
  mark: { markSize: 64, word: null, direction: 'column' },
  stacked: {
    markSize: 72,
    word: { fontSize: 26, lineHeight: 33 },
    direction: 'column',
  },
  inline: {
    markSize: 40,
    word: { fontSize: 22, lineHeight: 28 },
    direction: 'row',
  },
} as const satisfies Record<
  BrandLockup,
  {
    markSize: number;
    word: { fontSize: number; lineHeight: number } | null;
    direction: ViewStyle['flexDirection'];
  }
>;

export interface BrandMarkProps {
  lockup?: BrandLockup;
  /** Overrides the lockup's shield size, in points. */
  markSize?: number;
  style?: ViewStyle;
}

/**
 * The MyOrganizer mark: a shield in the brand gradient carrying a check, and
 * the two-weight wordmark — "My" lighter, "Organizer" at 800 — in the
 * foreground colour.
 *
 * The shield is drawn in the Brand Primitives rather than the Semantic Roles,
 * and the same in both colour modes: it is the logo, and a logo that changes
 * colour with the theme is two logos. Violet to trust teal, top to bottom,
 * with the check in the colour that sits on violet.
 *
 * One accessibility element named "MyOrganizer"; the parts are not read. It
 * is a picture and not a control, so it is no keyboard stop (`staticElement`),
 * and the wordmark is kept from the screen reader so that it is not read a
 * second time.
 */
export function BrandMark({
  lockup = 'stacked',
  markSize,
  style,
}: BrandMarkProps): React.JSX.Element {
  const theme = useTheme();
  const gradientId = `brand-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { markSize: lockupMarkSize, word, direction } = LOCKUPS[lockup];
  const size = markSize ?? lockupMarkSize;

  return (
    <View
      {...staticElement()}
      accessibilityRole="image"
      accessibilityLabel="MyOrganizer"
      style={[
        styles.lockup,
        {
          flexDirection: direction,
          // The sheet spaces the stacked lockup 16 and the inline one 10,
          // which rounds to `sm`.
          gap: direction === 'row' ? theme.spacing.sm : theme.spacing.md,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        {/* A gradient is registered by id wherever it sits in the tree, so it
            needs no <Defs> wrapper. */}
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colorSecondary} />
          <Stop offset="1" stopColor={colorTertiary} />
        </LinearGradient>
        <Path
          d="M4 3 L28 3 L28 19 Q28 30 16 31 Q4 30 4 19 Z"
          fill={`url(#${gradientId})`}
        />
        <Path
          d="M8 17 L13.5 22.5 L24 11"
          stroke={colorOnSecondary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      {word !== null && (
        <Text
          importantForAccessibility="no"
          variant="display"
          color="foreground"
          numberOfLines={1}
          style={{
            fontSize: word.fontSize,
            lineHeight: word.lineHeight,
            // The display step's tracking, in em, applied at the wordmark's
            // own size.
            letterSpacing:
              (theme.type.display.letterSpacing / theme.type.display.fontSize) *
              word.fontSize,
          }}
        >
          {/* "My" is drawn at 600, and the display face bundles no 600 cut;
              it takes the nearest bundled weight, 700. */}
          <RNText style={{ fontFamily: fontCutFor('display', '700') }}>
            My
          </RNText>
          <RNText style={{ fontFamily: fontCutFor('display', '800') }}>
            Organizer
          </RNText>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'center',
  },
});
