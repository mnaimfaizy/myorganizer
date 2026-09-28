import React from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';

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
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.base,
        { backgroundColor: theme.colors.background },
        !noPadding && { paddingHorizontal: theme.spacing.gutter },
        style,
      ]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
