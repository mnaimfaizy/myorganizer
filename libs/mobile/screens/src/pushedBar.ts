import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/**
 * What a pushed screen's own bar on Android draws, read from the options the
 * native bar reads on iOS: `headerTitle` over `title`, and the rule from
 * `headerShadowVisible`, which a screen sets while content is scrolled under
 * the bar (`useBarRuleOnScroll`).
 *
 * Only an explicit `true` counts as scrolled under: an option nobody set is a
 * bar at rest, not a bar with a rule.
 */
export function pushedBarProps(
  options: Pick<
    NativeStackNavigationOptions,
    'headerTitle' | 'title' | 'headerShadowVisible'
  >,
): { title: string; scrolledUnder: boolean } {
  return {
    title:
      typeof options.headerTitle === 'string'
        ? options.headerTitle
        : (options.title ?? ''),
    scrolledUnder: options.headerShadowVisible === true,
  };
}

/**
 * The option a screen sets to say whether content is scrolled under its bar,
 * or `null` where the platform's own bar already knows.
 *
 * Android only. There the bar is this app's own and knows nothing of the
 * scroll position unless the screen says so; iOS draws its own hairline at
 * the scroll edge, and setting a shadow option on its native bar is what
 * `headerChrome` is careful not to do.
 */
export function barRuleOptions(
  os: string,
  scrolledUnder: boolean,
): Pick<NativeStackNavigationOptions, 'headerShadowVisible'> | null {
  return os === 'android' ? { headerShadowVisible: scrolledUnder } : null;
}
