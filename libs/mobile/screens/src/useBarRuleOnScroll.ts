import { useLayoutEffect } from 'react';
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation, type ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLargeTitleCollapse } from '@myorganizer/mobile/ui';
import { barRuleOptions } from './pushedBar';

/**
 * Draws the rule under a pushed screen's bar while content is scrolled under
 * it, for a screen whose bar never carries a title (Task detail, Subscription
 * detail). A bar that takes the title on scroll needs none of this: the title
 * brings the rule with it.
 *
 * Android only (`barRuleOptions` has why): there the bar is this app's own
 * (`PushedScreenLayout`) and reads the option this sets.
 *
 * ```tsx
 * const barRule = useBarRuleOnScroll();
 * <ScrollView
 *   onScroll={barRule.onScroll}
 *   scrollEventThrottle={barRule.scrollEventThrottle}
 * />
 * ```
 */
export function useBarRuleOnScroll(): {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
} {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  // No large title here: the bar is "collapsed" as soon as anything is under it.
  const { collapsed, onScroll, scrollEventThrottle } = useLargeTitleCollapse(0);

  useLayoutEffect(() => {
    const options = barRuleOptions(Platform.OS, collapsed);
    if (options !== null) navigation.setOptions(options);
  }, [navigation, collapsed]);

  return { onScroll, scrollEventThrottle };
}
