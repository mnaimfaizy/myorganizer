import { haptics } from './haptics';

function trigger(): jest.Mock {
  return jest.requireMock<{ default: { trigger: jest.Mock } }>(
    'react-native-haptic-feedback',
  ).default.trigger;
}

describe('haptics (iOS waveforms)', () => {
  beforeEach(() => trigger().mockClear());

  it('ticks with a light impact', () => {
    haptics.tick();
    expect(trigger()).toHaveBeenCalledWith('impactLight', expect.any(Object));
  });

  it('unticks with a selection', () => {
    haptics.untick();
    expect(trigger()).toHaveBeenCalledWith('selection', expect.any(Object));
  });

  it('reverts with a warning notification', () => {
    haptics.revert();
    expect(trigger()).toHaveBeenCalledWith(
      'notificationWarning',
      expect.any(Object),
    );
  });

  it('never overrides the system haptic setting', () => {
    haptics.tick();
    expect(trigger()).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ ignoreAndroidSystemSettings: false }),
    );
  });
});
