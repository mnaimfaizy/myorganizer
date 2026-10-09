import { disabledNatively } from './focusHeld';

describe('disabledNatively', () => {
  it('should disable an inert control that does not hold focus', () => {
    expect(disabledNatively(true, false)).toBe(true);
  });

  it('should leave an inert control enabled while it holds focus', () => {
    expect(disabledNatively(true, true)).toBe(false);
  });

  it('should leave a live control enabled, focused or not', () => {
    expect(disabledNatively(false, false)).toBe(false);
    expect(disabledNatively(false, true)).toBe(false);
  });
});
