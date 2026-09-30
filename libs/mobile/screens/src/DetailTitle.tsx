import React, { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, useTheme } from '@myorganizer/mobile/ui';
import type { DetailsStackParamList } from './detailsStack';

/**
 * A pushed Details screen's navigation bar: the back affordance and Lock, and
 * no title while the screen's own title is showing — the Details sheets draw
 * the title large in the content, under a bare bar. Once that title has
 * scrolled away (`collapsed`), the bar takes it, so the screen is never
 * untitled.
 *
 * `backTitle` names the screen below when the stack cannot: the bar shows no
 * title there, so iOS would otherwise fall back to "Back" (Det-UL: "‹ Home").
 */
export function useDetailNavigationTitle(
  title: string,
  collapsed: boolean,
  backTitle?: string,
): void {
  const navigation =
    useNavigation<NativeStackNavigationProp<DetailsStackParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerTitle: collapsed ? title : '',
      ...(backTitle != null ? { headerBackTitle: backTitle } : {}),
    });
  }, [navigation, title, collapsed, backTitle]);
}

export interface DetailTitleProps {
  title: string;
  /** Drawn under the title, on one line with `hint` — the Current/Old pill. */
  accessory?: React.ReactNode;
  /** A short muted line — "Tap a line to copy it". */
  hint?: string;
  /**
   * `display` (34/40) for an Address or Mobile Number, as the Details sheets
   * set its name; `titleLg` (28/34) for the Usage Locations screen.
   */
  size?: 'display' | 'titleLg';
}

/** A pushed Details screen's own title block, drawn in the content. */
export function DetailTitle({
  title,
  accessory,
  hint,
  size = 'display',
}: DetailTitleProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        gap: size === 'display' ? theme.spacing.sm : theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        // Det-UL draws 12 under its title, exactly between `sm` and `md`; a tie
        // rounds up, so both sizes take `md`.
        paddingBottom: theme.spacing.md,
      }}
    >
      <Text variant={size} accessibilityRole="header">
        {title}
      </Text>
      {(accessory != null || hint != null) && (
        <View style={[styles.inline, { gap: theme.spacing.sm }]}>
          {accessory}
          {hint != null && (
            <Text
              variant={size === 'display' ? 'caption' : 'bodySm'}
              color="mutedForeground"
              style={styles.grow}
            >
              {hint}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  grow: {
    flexShrink: 1,
  },
});
