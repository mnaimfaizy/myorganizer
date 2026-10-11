import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type PressableProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useKeyboardBackGuard } from '../hooks/useKeyboardBackGuard';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ColorMode, ThemeColors } from '../theme';
import { FocusLayerContext, useFocusLayer } from '../hooks/focusLayer';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { Icon } from './Icon';
import { SurfaceContext } from './surface';
import { Text } from './Text';

/**
 * The navigation bar a full-height form sheet carries in place of a handle
 * and title (Subscriptions · Edit and New sheets): Cancel on the leading edge,
 * the title centred, and the sheet's one primary action on the trailing edge.
 */
export interface BottomSheetNavBar {
  /** Leading action. Defaults to "Cancel", and to the sheet's `onDismiss`. */
  cancelLabel?: string;
  onCancel?: () => void;
  /** The trailing primary action — "Save", "Add". */
  actionLabel: string;
  onAction: () => void;
  /** Dims the action and stops it accepting presses — an incomplete form. */
  actionDisabled?: boolean;
  /** Shows a spinner in place of the action while it is in flight. */
  actionBusy?: boolean;
}

export interface BottomSheetProps {
  visible: boolean;
  /**
   * Called for a tap on the scrim, the close button, the nav bar's Cancel,
   * and Android's Back or Escape — except the one pressed with the soft
   * keyboard up for a field of the sheet's own, which hides the keyboard and
   * leaves the sheet (#949).
   */
  onDismiss: () => void;
  /**
   * The sheet's own title. Also what the sheet is announced as: it is where
   * a screen reader starts when the sheet opens.
   */
  title?: string;
  /**
   * Adds a close (×) button beside the title — the tall sheet on the
   * Overlays sheet ("Add item"), whose primary action is pinned at the foot.
   */
  showClose?: boolean;
  /**
   * Pinned below the content, above the bottom inset — the tall sheet's
   * primary action. The content above it is what scrolls.
   */
  footer?: React.ReactNode;
  /**
   * Presents the sheet full height with a navigation bar instead of a handle
   * and title — the form sheet for editing or adding a record. Its content
   * scrolls, and it sits on the page background rather than a raised
   * surface, because it is the whole screen while it is up.
   */
  navBar?: BottomSheetNavBar;
  children?: React.ReactNode;
}

/**
 * The handle's colour per mode. `ring` is the grey the sheet draws in light;
 * in dark `ring` is the border grey and would vanish into the raised sheet,
 * so the sheet draws the handle in `mutedForeground` there.
 */
const HANDLE_ROLE_BY_MODE = {
  light: 'ring',
  dark: 'mutedForeground',
} as const satisfies Record<ColorMode, keyof ThemeColors>;

/**
 * The handle's size per platform (Platform sheet): the system grabber's
 * 36 × 5 on iOS, Material's 32 × 4 on Android.
 */
const HANDLE = Platform.select({
  android: { width: 32, height: 4 },
  default: { width: 36, height: 5 },
});

/** The form sheet's nav bar height on the Subscriptions sheets. */
const NAV_BAR_HEIGHT = 56;

/**
 * A panel that comes up over the screen and takes the interaction until it is
 * answered.
 *
 * It is the one thing in the app that covers the tab bar, and that is the
 * whole of the rule: the bar stays on every screen pushed inside a tab, and
 * hides only for a sheet or a form like this one.
 *
 * Two presentations:
 *
 * - **Fit** (default) — sized to its content, up to 40pt below the top. The
 *   raised surface on a scrim (P7), with a handle and a title. In dark the
 *   raised surface is `muted` with a `border` top edge (P6), because `popover`
 *   and `card` equal the background there and the sheet would have no edge.
 * - **Form** (`navBar`) — full height, with a Cancel / title / action bar.
 *
 * `accessibilityViewIsModal` is what keeps a screen reader inside the panel;
 * without it the list behind the scrim is still swipeable, and the User can
 * act on a row they cannot see.
 *
 * A screen reader starts on the sheet's content, not on its scrim
 * (`SCRIM_OVERHANG`).
 */
export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const reduceMotion = useReduceMotion();
  // The sheet is its own window, so it is its own focus layer: while it is
  // up, no control behind it draws a focus ring.
  const focusLayer = useFocusLayer(props.visible);
  const requestClose = useKeyboardBackGuard(props.onDismiss, props.visible);

  return (
    <Modal
      visible={props.visible}
      transparent={props.navBar === undefined}
      // Reduce Motion takes the travel, not the sheet: it still appears and
      // still covers what it covered, without sliding up to do it.
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={requestClose}
      // Edge-to-edge like the screen under it (Android enforces it there):
      // with the status bar alone translucent, the dialog window still fits
      // inside the system bars and the sheet's safe-area padding lands twice.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <FocusLayerContext.Provider value={focusLayer}>
        {props.navBar === undefined ? (
          <FitSheet {...props} />
        ) : (
          <FormSheet {...props} navBar={props.navBar} />
        )}
      </FocusLayerContext.Provider>
    </Modal>
  );
}

/**
 * Whether a sheet's `KeyboardAvoidingView` pads for the keyboard. Always on
 * iOS; on Android only while the keyboard is up, because React Native 0.79
 * reported its hiding with the window's visible frame — the frame less the
 * system bars — and a sheet drawn edge-to-edge in a Modal kept that
 * difference as padding once the keyboard had gone.
 *
 * React Native 0.87 adds the bar insets to that event (`ReactRootView`'s
 * `keyboardDidHide` payload), which reads as the fix. The guard is kept: it
 * costs nothing while the keyboard is down, and whether a sheet in a Modal is
 * right without it has not been re-checked on a device.
 */
function useAvoidKeyboard(): boolean {
  const keyboardVisible = useKeyboardVisible();
  return Platform.OS === 'ios' || keyboardVisible;
}

/** The one accessibility action the scrim declares on Android. */
const SCRIM_ACTIONS = [{ name: 'activate' }] as const;

/**
 * What takes the scrim out of the Tab order on Android and leaves it a
 * control a screen reader can still land on and activate.
 *
 * The scrim comes first in the sheet's window and covers all of it, so a
 * hardware keyboard's first Tab landed there, ahead of the sheet's own
 * controls, and the ring it drew went round the whole display (#1028). A
 * keyboard does not need the stop: Back and Escape reach the sheet's
 * `onRequestClose` (`useKeyboardBackGuard`).
 *
 * `accessible` is the Tab stop on Android (see `staticElement.ts`), and a
 * `Pressable` asks for a second one through `focusable`, which is also what
 * installs the native click listener a screen reader's double-tap reaches. So
 * both go, `screenReaderFocusable` keeps TalkBack landing on the scrim, and
 * the `activate` action is the double-tap's way back to `onDismiss`. A touch
 * never went through that listener — `onPress` is the responder system's —
 * so a tap on the scrim dismisses as it did.
 *
 * iOS is left as it was: it has no Tab order for `accessible` to join.
 *
 * Called at render rather than held as a constant, so a spec can render either
 * platform's answer.
 */
function scrimKeyboardSkip(
  onDismiss: () => void,
): Pick<
  PressableProps,
  | 'accessible'
  | 'focusable'
  | 'screenReaderFocusable'
  | 'accessibilityActions'
  | 'onAccessibilityAction'
> | null {
  return Platform.OS === 'android'
    ? {
        accessible: false,
        focusable: false,
        screenReaderFocusable: true,
        accessibilityActions: SCRIM_ACTIONS,
        onAccessibilityAction: (event: AccessibilityActionEvent) => {
          if (event.nativeEvent.actionName === 'activate') onDismiss();
        },
      }
    : null;
}

/**
 * How far the panel reaches past each side of the scrim, off the screen.
 *
 * It is what makes a screen reader start on the sheet and not on "Dismiss"
 * (#1090). Android orders the views of one parent for accessibility by where
 * they are, not by the order they were added in: of two that share a row,
 * the one starting further toward the leading edge comes first, and at a tie
 * the one starting higher — which was the scrim, since it covers the display.
 * TalkBack opens a new window on the first of them. A panel that starts one
 * pixel before the scrim wins the first comparison, on either side so it
 * holds in a right-to-left layout, and the scrim follows the sheet's content
 * as its last stop.
 *
 * The padding grows by the same amount, so nothing inside the panel moves.
 * iOS has no such order to win: `accessibilityViewIsModal` keeps VoiceOver
 * inside the panel.
 */
const SCRIM_OVERHANG = StyleSheet.hairlineWidth;

function FitSheet({
  onDismiss,
  title,
  showClose = false,
  footer,
  children,
}: BottomSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const closeFeedback = usePressFeedback('borderless');
  const closeFocus = useFocusRing();
  const dark = theme.mode === 'dark';
  const avoidKeyboard = useAvoidKeyboard();

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior="padding"
      enabled={avoidKeyboard}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
        onPress={onDismiss}
        {...scrimKeyboardSkip(onDismiss)}
      />
      {/* Not labelled with the title: on Android the label made the panel a
          second node saying what the header inside already says (#1090). */}
      <View
        accessibilityViewIsModal
        testID="sheet-panel"
        style={[
          styles.sheet,
          styles.aheadOfScrim,
          {
            // A tall sheet stops 40pt below the top of the screen.
            maxHeight:
              windowHeight - insets.top - (theme.spacing.xl + theme.spacing.sm),
            paddingTop: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md + SCRIM_OVERHANG,
            paddingBottom: insets.bottom + theme.spacing.sm,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            backgroundColor: theme.colors.raisedSurface,
          },
          dark
            ? { borderTopWidth: 1, borderColor: theme.colors.border }
            : theme.shadows.popover,
        ]}
      >
        <View
          style={[styles.handleArea, { paddingVertical: theme.spacing.sm }]}
        >
          <View
            style={[
              styles.handle,
              HANDLE,
              {
                borderRadius: theme.radii.full,
                backgroundColor: theme.colors[HANDLE_ROLE_BY_MODE[theme.mode]],
              },
            ]}
          />
        </View>
        {(title != null || showClose) && (
          <View style={[styles.titleRow, { gap: theme.spacing.sm }]}>
            {title != null && (
              <Text
                variant="title"
                color="foreground"
                accessibilityRole="header"
                style={styles.title}
              >
                {title}
              </Text>
            )}
            {showClose && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onDismiss}
                onFocus={closeFocus.onFocus}
                onBlur={closeFocus.onBlur}
                android_ripple={closeFocus.ripple(closeFeedback.android_ripple)}
                style={({ pressed }) => [
                  styles.close,
                  {
                    minWidth: MIN_TOUCH_TARGET,
                    minHeight: MIN_TOUCH_TARGET,
                    borderRadius: theme.radii.full,
                  },
                  closeFeedback.pressedStyle(pressed),
                  closeFocus.ringStyle,
                ]}
              >
                <Icon name="close" size={22} color="popoverForeground" />
              </Pressable>
            )}
          </View>
        )}
        <SurfaceContext.Provider value="sheet">
          {/* Not a ScrollView: a sheet whose content can outgrow it — a
              catalog list under a field — brings its own, which takes the
              space this column is allowed to shrink to. */}
          <View
            style={[
              styles.shrink,
              {
                gap: theme.spacing.md,
                paddingTop: title != null ? theme.spacing.sm : 0,
              },
            ]}
          >
            {children}
          </View>
          {footer != null && (
            <View style={{ paddingTop: theme.spacing.lg }}>{footer}</View>
          )}
        </SurfaceContext.Provider>
      </View>
    </KeyboardAvoidingView>
  );
}

function FormSheet({
  onDismiss,
  title,
  navBar,
  footer,
  children,
}: BottomSheetProps & { navBar: BottomSheetNavBar }): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    cancelLabel = 'Cancel',
    onCancel = onDismiss,
    actionLabel,
    onAction,
    actionDisabled = false,
    actionBusy = false,
  } = navBar;
  const actionInert = actionDisabled || actionBusy;
  const avoidKeyboard = useAvoidKeyboard();

  return (
    <KeyboardAvoidingView
      accessibilityViewIsModal
      accessibilityLabel={title}
      style={[
        styles.fill,
        {
          paddingTop: insets.top,
          backgroundColor: theme.colors.background,
        },
      ]}
      behavior="padding"
      enabled={avoidKeyboard}
    >
      <View
        style={[
          styles.navBar,
          {
            minHeight: NAV_BAR_HEIGHT,
            paddingHorizontal: theme.spacing.xs,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={[styles.navSide, styles.navLeading]}>
          <NavAction label={cancelLabel} onPress={onCancel} />
        </View>
        {title != null && (
          <Text
            variant="body"
            weight="semibold"
            color="foreground"
            accessibilityRole="header"
            numberOfLines={1}
            style={styles.navTitle}
          >
            {title}
          </Text>
        )}
        <View style={[styles.navSide, styles.navTrailing]}>
          <NavAction
            label={actionLabel}
            onPress={onAction}
            emphasised
            disabled={actionInert}
            busy={actionBusy}
          />
        </View>
      </View>
      <SurfaceContext.Provider value="page">
        <ScrollView
          style={styles.fill}
          contentContainerStyle={{
            gap: theme.spacing.lg,
            // The sheet pads its content 20 from the bar — halfway between
            // `md` and `lg`, so it takes `lg`.
            paddingTop: theme.spacing.lg,
            paddingHorizontal: theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer != null && (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingBottom: insets.bottom + theme.spacing.sm,
            }}
          >
            {footer}
          </View>
        )}
      </SurfaceContext.Provider>
    </KeyboardAvoidingView>
  );
}

/** A text action in the form sheet's nav bar: Cancel, or the primary action. */
function NavAction({
  label,
  onPress,
  emphasised = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  emphasised?: boolean;
  disabled?: boolean;
  busy?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback();
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={focus.ripple(feedback.android_ripple)}
      style={({ pressed }) => [
        styles.navAction,
        {
          minHeight: MIN_TOUCH_TARGET,
          minWidth: MIN_TOUCH_TARGET,
          // The sheet pads a bar action 12 a side, halfway between two steps.
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
        },
        feedback.pressedStyle(pressed),
        focus.ringStyle,
        disabled && !busy && styles.dimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : (
        <Text
          variant="body"
          weight={emphasised ? 'bold' : undefined}
          color="foreground"
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  shrink: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    marginTop: 'auto',
  },
  aheadOfScrim: {
    marginHorizontal: -SCRIM_OVERHANG,
  },
  handleArea: {
    alignItems: 'center',
  },
  handle: {
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navSide: {
    flex: 1,
  },
  navLeading: {
    alignItems: 'flex-start',
  },
  navTrailing: {
    alignItems: 'flex-end',
  },
  navTitle: {
    flex: 2,
    textAlign: 'center',
  },
  navAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.4,
  },
});
