import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ThemeColors } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** How loud a notice is. Not a status — a notice is always about right now. */
export type NoticeTone = 'destructive' | 'warning' | 'neutral';

/**
 * What each tone is made of, named by Semantic Role rather than by resolved
 * colour so one table serves both colour modes. Pinned to the tone set.
 *
 * `errorText` rather than `destructive` for the destructive tone: the two
 * match in light, and in dark `destructive` is a deep fill meant to sit behind
 * white text, which is unreadable as text on the page background.
 */
const TONES = {
  destructive: { icon: 'error', text: 'errorText', edge: 'errorEdge' },
  warning: { icon: 'warning', text: 'warning', edge: 'warning' },
  neutral: { icon: 'info', text: 'mutedForeground', edge: 'border' },
} as const satisfies Record<
  NoticeTone,
  { icon: IconName; text: keyof ThemeColors; edge: keyof ThemeColors }
>;

export interface InlineNoticeProps {
  /** One line. A notice that needs a paragraph is not a notice. */
  message: string;
  tone?: NoticeTone;
  /** Overrides the tone's glyph, where the cause is more specific than the tone. */
  icon?: IconName;
  /** An optional way out — Retry, most often. */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/**
 * An icon and one line, announced when it appears.
 *
 * Every in-page message in the app is this component: the entry screens' error
 * lines, a field's validation message, and the reason a row's edit was
 * reverted. They were three different shapes before, which meant three
 * different answers to whether a screen reader ever heard them.
 *
 * `alert` is the role and `assertive` the live region because the message is
 * always the consequence of something the User just did, and a message that
 * waits for the next natural pause arrives after they have moved on.
 */
export function InlineNotice({
  message,
  tone = 'neutral',
  icon,
  actionLabel,
  onAction,
  style,
}: InlineNoticeProps): React.JSX.Element {
  const theme = useTheme();
  const { icon: toneIcon, text, edge } = TONES[tone];

  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderColor: theme.colors[edge],
          backgroundColor: theme.colors.card,
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
        <Icon name={icon ?? toneIcon} size={20} color={text} />
        <Text variant="bodySm" color={text} style={styles.messageText}>
          {message}
        </Text>
      </View>
      {actionLabel != null && onAction != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [
            styles.action,
            { minHeight: MIN_TOUCH_TARGET },
            pressed && styles.pressed,
          ]}
        >
          <Text variant="bodySm" color="brand">
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
    borderWidth: 1,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexGrow: 1,
  },
  messageText: {
    flexShrink: 1,
  },
  action: {
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
