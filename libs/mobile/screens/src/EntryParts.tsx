import React, { useEffect } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  BrandMark,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  usePressFeedback,
  useTheme,
  type ColorMode,
  type IconName,
} from '@myorganizer/mobile/ui';

/*
 * The pieces the Entry screens — Sign in, Forgot password, Unlock, Recovery
 * Key, No Vault yet, and the Biometric Unlock offer — share and nothing else
 * draws. They are Feature Components rather than UI Primitives: each is one
 * Entry sheet's drawing, not a control another feature would reach for.
 */

/**
 * The strength of the brand tint behind the Unlock and No Vault yet badges,
 * per mode. The Entry sheets draw violet at 10% in light and the lighter dark
 * violet at 16% in dark; no token carries a tint, so the fill is the `brand`
 * role under this opacity rather than a second colour.
 */
const BADGE_TINT = {
  light: 0.1,
  dark: 0.16,
} as const satisfies Record<ColorMode, number>;

/** The offer sheet's icon tile, which the sheets draw at 12% in both modes. */
const TILE_TINT = 0.12;

/** A layer of `brand` at `opacity`, filling its parent. */
function BrandTint({ opacity }: { opacity: number }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.brand, opacity },
      ]}
    />
  );
}

/**
 * The shield in a brand-tinted circle — the Unlock screen's 104pt badge with a
 * 64pt mark, and No Vault yet's 96pt one with a 56pt mark.
 */
export function BrandBadge({
  size,
  markSize,
}: {
  size: number;
  markSize: number;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.centred,
        {
          width: size,
          height: size,
          borderRadius: theme.radii.full,
          overflow: 'hidden',
        },
      ]}
    >
      <BrandTint opacity={BADGE_TINT[theme.mode]} />
      <BrandMark lockup="mark" markSize={markSize} />
    </View>
  );
}

/** The offer sheet's 64pt icon tile, the method's glyph on a brand tint. */
export function BrandIconTile({ icon }: { icon: IconName }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.centred,
        styles.tile,
        // The sheet draws the tile at radius 16, which is `xl`.
        { borderRadius: theme.radii.xl, overflow: 'hidden' },
      ]}
    >
      <BrandTint opacity={TILE_TINT} />
      <Icon name={icon} size={32} color="brand" />
    </View>
  );
}

/** Forgot password's 64pt icon tile: a glyph on the `muted` panel. */
export function MutedIconTile({ icon }: { icon: IconName }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.centred,
        styles.tile,
        { borderRadius: theme.radii.xl, backgroundColor: theme.colors.muted },
      ]}
    >
      <Icon name={icon} size={30} />
    </View>
  );
}

/**
 * The in-screen back link — "‹ Sign in" on Forgot password, "‹ Unlock" on the
 * Recovery Key screen. The Entry screens carry no navigation bar, so the way
 * back is drawn into the page; Android's back button does the same thing.
 */
export function BackLink({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback();
  return (
    <View style={styles.backRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back to ${label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        android_ripple={feedback.android_ripple}
        style={({ pressed }) => [
          styles.back,
          {
            minHeight: MIN_TOUCH_TARGET,
            // The sheet pulls the link 12 into the gutter so the chevron
            // lines up with the text below it, and pads it 4 a side.
            marginLeft: -(theme.spacing.sm + theme.spacing.xs),
            paddingHorizontal: theme.spacing.xs,
            borderRadius: theme.radii.md,
          },
          feedback.pressedStyle(pressed),
        ]}
      >
        <Icon name="chevronLeft" size={24} strokeWidth={2.4} />
        <Text variant="body">{label}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Sends Android's back button to `onBack` while `active` — the Entry screens'
 * inner views (Forgot password, the Recovery Key screen) are views of one
 * route rather than routes of their own, so the navigator would otherwise
 * read back as leaving the app.
 */
export function useHardwareBack(active: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [active, onBack]);
}

/** "or use your passphrase" between the biometric button and the field. */
export function OrDivider({ label }: { label: string }): React.JSX.Element {
  const theme = useTheme();
  const rule = [styles.rule, { backgroundColor: theme.colors.border }];
  return (
    <View
      style={[styles.divider, { gap: theme.spacing.sm + theme.spacing.xs }]}
    >
      <View style={rule} />
      <Text variant="caption">{label}</Text>
      <View style={rule} />
    </View>
  );
}

/**
 * The Entry screens' scroll root. Every one of them is a short column that
 * fits a phone at 100% text, and none of them fits at 200% with the keyboard
 * up — so the column scrolls, grows to fill the screen when it is short (the
 * sheets pin actions to the foot with a spacer), and moves out of the
 * keyboard's way on iOS.
 */
export function EntryScroll({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.grow, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  grow: {
    flexGrow: 1,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: 64,
    height: 64,
  },
  backRow: {
    flexDirection: 'row',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rule: {
    flex: 1,
    // The sheet's 1pt rule, as every list separator in the app draws it.
    height: 1,
  },
});
