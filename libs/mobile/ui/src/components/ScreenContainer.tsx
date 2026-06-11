import React from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

export interface ScreenContainerProps extends ViewProps {
  children?: React.ReactNode;
  noPadding?: boolean;
}

export function ScreenContainer({
  children,
  noPadding = false,
  style,
  ...rest
}: ScreenContainerProps): React.JSX.Element {
  return (
    <SafeAreaView
      style={[styles.base, !noPadding && styles.padded, style]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  padded: {
    paddingHorizontal: theme.spacing.gutter,
  },
});
