// @myorganizer/mobile/ui — shared theme + React Native UI Primitives.
export {
  darkTheme,
  lightTheme,
  themeForMode,
  type ColorMode,
  type Theme,
  type ThemeColors,
} from './theme';
export {
  FONT_FAMILY,
  fontCutFor,
  type TypeFace,
  toRnLetterSpacing,
  toRnSize,
  typeScale,
  type TypeScaleStep,
  type TypeStyle,
} from './typeScale';
export { shadows, toRnShadow, type Shadow, type ShadowName } from './shadows';
export {
  MIN_TOUCH_TARGET,
  TAB_LABEL_SCALE_CAP,
  TEXT_SCALE_CAP,
} from './metrics';
export { resolveColorMode } from './appearance';
export { ThemeProvider, useTheme, type ThemeProviderProps } from './useTheme';
export { haptics } from './haptics';
export { useReduceMotion } from './hooks/useReduceMotion';
export { useIsOffline } from './hooks/useIsOffline';
export { useKeyboardVisible } from './hooks/useKeyboardVisible';
export { useAppState } from './hooks/useAppState';

export { BottomSheet, type BottomSheetProps } from './components/BottomSheet';
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
} from './components/Button';
export {
  Checkbox,
  type CheckboxProps,
  type CheckboxSize,
} from './components/Checkbox';
export { Chip, type ChipProps } from './components/Chip';
export {
  ConfirmSheet,
  type ConfirmSheetProps,
} from './components/ConfirmSheet';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export { Icon, type IconName, type IconProps } from './components/Icon';
export {
  InlineNotice,
  type InlineNoticeProps,
  type NoticeTone,
} from './components/InlineNotice';
export {
  LargeTitleHeader,
  type LargeTitleHeaderProps,
} from './components/LargeTitleHeader';
export {
  ListRow,
  type ListRowProps,
  type ListRowState,
  type SwipeAction,
} from './components/ListRow';
export { ListSection, type ListSectionProps } from './components/ListSection';
export { LockAction, type LockActionProps } from './components/LockAction';
export {
  OfflineBanner,
  type OfflineBannerProps,
} from './components/OfflineBanner';
export {
  PrivacyCover,
  type PrivacyCoverProps,
} from './components/PrivacyCover';
export {
  ProgressMeter,
  type ProgressMeterProps,
} from './components/ProgressMeter';
export { Screen, type ScreenProps } from './components/Screen';
export {
  SegmentedControl,
  type Segment,
  type SegmentedControlProps,
} from './components/SegmentedControl';
export { Skeleton, type SkeletonProps } from './components/Skeleton';
export { Snackbar, type SnackbarProps } from './components/Snackbar';
export {
  StatusPill,
  type StatusPillProps,
  type StatusTone,
} from './components/StatusPill';
export { Switch, type SwitchProps } from './components/Switch';
export { TabBar, type TabBarItem, type TabBarProps } from './components/TabBar';
export { Text, type TextProps } from './components/Text';
export { TextField, type TextFieldProps } from './components/TextField';
