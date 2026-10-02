import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ThemeColors } from '../theme';
import type { TypeScaleStep } from '../typeScale';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * How loud a notice is. Not a status — a notice is always about right now.
 *
 * - `destructive` — something failed.
 * - `warning` — nothing failed, but something cannot happen yet (offline,
 *   unverified email).
 * - `neutral` — a quiet aside ("To set a new passphrase, use the web app.").
 * - `info` — a fact the User should read, in full contrast (Account's "this
 *   phone" card).
 */
export type NoticeTone = 'destructive' | 'warning' | 'neutral' | 'info';

/**
 * - `inline` — an icon and a line of supporting copy, unboxed, under a form
 *   (Entry sheets).
 * - `compact` — a smaller line with its action beside it, under the row or
 *   field it is about (a reverted edit: "Not saved — you’re offline.").
 * - `card` — the same line on a `muted` panel, set apart from the list it
 *   introduces (Account).
 */
export type NoticeVariant = 'inline' | 'compact' | 'card';

/**
 * What each tone is made of, named by Semantic Role rather than by resolved
 * colour so one table serves both colour modes. Pinned to the tone set.
 *
 * The glyph carries the tone and the line stays readable: `errorText` rather
 * than `destructive` for a failure, because in dark `destructive` is a deep
 * fill meant to sit behind white text and is unreadable as text (P2).
 */
const TONES = {
  destructive: { icon: 'error', glyph: 'errorEdge', text: 'errorText' },
  warning: { icon: 'warning', glyph: 'warning', text: 'foreground' },
  neutral: { icon: 'info', glyph: 'mutedForeground', text: 'mutedForeground' },
  info: { icon: 'info', glyph: 'foreground', text: 'foreground' },
} as const satisfies Record<
  NoticeTone,
  { icon: IconName; glyph: keyof ThemeColors; text: keyof ThemeColors }
>;

/** Each variant's glyph size, text step and whether it sits on a panel. */
const VARIANTS = {
  inline: { iconSize: 18, step: 'bodySm', panel: false },
  compact: { iconSize: 16, step: 'caption', panel: false },
  card: { iconSize: 16, step: 'caption', panel: true },
} as const satisfies Record<
  NoticeVariant,
  { iconSize: number; step: TypeScaleStep; panel: boolean }
>;

export interface InlineNoticeProps {
  /** One line. A notice that needs a paragraph is not a notice. */
  message: string;
  tone?: NoticeTone;
  variant?: NoticeVariant;
  /** Overrides the tone's glyph, where the cause is more specific than the tone. */
  icon?: IconName;
  /**
   * Overrides the tone's glyph colour and leaves the line's alone — Sign in's
   * disabled-account line draws a red mark beside body text, and Unlock's
   * "Unlocking —" status a brand-violet spinner beside a muted line.
   */
  iconColor?: keyof ThemeColors;
  /** An optional way out — Retry, most often. */
  actionLabel?: string;
  /** A glyph before the action's label — `retry` for Retry. */
  actionIcon?: IconName;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * An icon and one line, announced when it appears.
 *
 * Every in-page message in the app is this component: the entry screens'
 * alert lines, a reverted edit's reason, and Account's device-only note. They
 * were several different shapes before, which meant several different answers
 * to whether a screen reader ever heard them. (A field's own validation
 * message belongs to `TextField`.)
 *
 * `alert` is the role and `assertive` the live region because the message is
 * almost always the consequence of something the User just did, and a message
 * that waits for the next natural pause arrives after they have moved on.
 */
export function InlineNotice({
  message,
  tone = 'neutral',
  variant = 'inline',
  icon,
  iconColor,
  actionLabel,
  actionIcon,
  onAction,
  style,
}: InlineNoticeProps): React.JSX.Element {
  const theme = useTheme();
  const actionFeedback = usePressFeedback();
  const { icon: toneIcon, glyph, text } = TONES[tone];
  const { iconSize, step, panel } = VARIANTS[variant];

  return (
    <View
      style={[
        styles.row,
        { gap: theme.spacing.sm },
        panel && {
          // The sheet draws the card 10 × 12 in at radius 10; each takes the
          // nearer step, and the halfway 12 and 10 take the larger.
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.muted,
        },
        style,
      ]}
    >
      {/* The icon and the message are one accessibility element, announced as
          an alert. `accessible` is what makes that true: a View carrying only
          a role is not an accessibility element on iOS, so the role reads as
          set while nothing is announced. The action stays outside this group
          so that grouping the message does not swallow the button. */}
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.message, { gap: theme.spacing.sm }]}
      >
        <View
          style={{
            // Centres the glyph on the first line rather than on the block.
            paddingTop: (theme.type[step].lineHeight - iconSize) / 2,
          }}
        >
          <Icon
            name={icon ?? toneIcon}
            size={iconSize}
            color={iconColor ?? glyph}
          />
        </View>
        <Text variant={step} color={text} style={styles.messageText}>
          {message}
        </Text>
      </View>
      {actionLabel != null && onAction != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          android_ripple={actionFeedback.android_ripple}
          style={({ pressed }) => [
            styles.action,
            {
              minHeight: MIN_TOUCH_TARGET,
              gap: theme.spacing.sm,
              // The sheet pads the action 12 a side, halfway between two steps.
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radii.md,
              borderColor: theme.colors.controlEdge,
            },
            actionFeedback.pressedStyle(pressed),
          ]}
        >
          {actionIcon != null && (
            <Icon name={actionIcon} size={16} color="foreground" />
          )}
          <Text variant="bodySm" weight="semibold" color="foreground">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 1,
    flexGrow: 1,
  },
  messageText: {
    flexShrink: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
