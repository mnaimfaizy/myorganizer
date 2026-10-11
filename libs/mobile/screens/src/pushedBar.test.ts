import { barRuleOptions, pushedBarProps } from './pushedBar';

describe('pushedBarProps', () => {
  it('should take the bar title from headerTitle over title', () => {
    expect(
      pushedBarProps({ title: 'Weekly shop', headerTitle: 'Collapsed' }).title,
    ).toBe('Collapsed');
  });

  // A screen clears the bar while its own large title shows by setting
  // `headerTitle: ''`, which must not fall back to `title`.
  it('should keep the bar untitled when headerTitle is the empty string', () => {
    expect(
      pushedBarProps({ title: 'Weekly shop', headerTitle: '' }).title,
    ).toBe('');
  });

  it('should fall back to title, then to no title', () => {
    expect(pushedBarProps({ title: 'Weekly shop' }).title).toBe('Weekly shop');
    expect(pushedBarProps({}).title).toBe('');
  });

  // The rule under an untitled bar (#948): only a screen that said so gets it.
  it('should report content scrolled under the bar only for an explicit true', () => {
    expect(pushedBarProps({ headerShadowVisible: true }).scrolledUnder).toBe(
      true,
    );
    expect(pushedBarProps({ headerShadowVisible: false }).scrolledUnder).toBe(
      false,
    );
    expect(pushedBarProps({}).scrolledUnder).toBe(false);
  });
});

describe('barRuleOptions', () => {
  it('should set the shadow option from the scroll position on Android', () => {
    expect(barRuleOptions('android', true)).toEqual({
      headerShadowVisible: true,
    });
    expect(barRuleOptions('android', false)).toEqual({
      headerShadowVisible: false,
    });
  });

  // iOS 26 stops drawing the large title when a shadow option is set.
  it('should set nothing on iOS, whatever the scroll position', () => {
    expect(barRuleOptions('ios', true)).toBeNull();
    expect(barRuleOptions('ios', false)).toBeNull();
  });
});
