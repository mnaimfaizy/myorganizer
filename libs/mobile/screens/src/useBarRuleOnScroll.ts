import { useLayoutEffect } from 'react';
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation, type ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLargeTitleCollapse } from '@myorganizer/mobile/ui';

/**
 * Draws the rule under a pushed screen's bar while content is scrolled under
 * it, for a screen whose bar never carries a title (Task detail, Subscription
 * detail). A bar that takes the title on scroll needs none of this: the title
 * brings the rule with it.
 *
 * Android only. There the bar is this app's own (`PushedScreenLayout`) and
 * knows nothing of the scroll position unless the screen says so; iOS draws
 * its own hairline at the scroll edge, and setting a shadow option on its
 * native bar is what `headerChrome` is careful not to do.
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
    if (Platform.OS !== 'android') return;
    navigation.setOptions({ headerShadowVisible: collapsed });
  }, [navigation, collapsed]);

  return { onScroll, scrollEventThrottle };
}
