import { Platform } from 'react-native';

/**
 * The smallest a tappable thing is allowed to be, in density-independent
 * pixels: 44 on iOS (Human Interface Guidelines) and 48 on Android (Material
 * accessibility). One constant rather than a literal per component, so a
 * control that meets it does so on both platforms.
 */
export const MIN_TOUCH_TARGET = Platform.OS === 'android' ? 48 : 44;

/**
 * The cap on the OS text-size multiplier, app-wide.
 *
 * Every string the app renders goes through the `Text` primitive and every
 * field through `TextField`, and both pass this to React Native, so the cap is
 * a property of the app rather than of the screens that remembered it. 2.0 is
 * the largest step the layouts are built to reflow at; above it a row's label
 * and its control stop fitting on one screen at any width.
 */
export const TEXT_SCALE_CAP = 2;

/**
 * The cap for a tab bar label, which is lower than the app's.
 *
 * Five labels share one bar width, so a label has about a fifth of the screen
 * whatever the text size is. Past 1.3× the longest name truncates instead of
 * growing, which is worse than not growing — so the label stops scaling and
 * the full name stays reachable through the tab's accessibility label.
 */
export const TAB_LABEL_SCALE_CAP = 1.3;
