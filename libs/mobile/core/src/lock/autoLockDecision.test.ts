import { shouldAutoLock } from './autoLockDecision';
import {
  autoLockDelayMs,
  toAutoLockDelay,
  describeAutoLock,
  DEFAULT_AUTO_LOCK_DELAY,
  type AutoLockDelay,
} from './autoLockDelay';

describe('autoLockDecision.ts', () => {
  describe('shouldAutoLock', () => {
    describe('when app never left foreground (backgroundedAt is null)', () => {
      it('returns false for every delay including immediately', () => {
        const delays: AutoLockDelay[] = ['immediately', '1m', '5m', '15m'];

        delays.forEach((delay) => {
          const result = shouldAutoLock({
            backgroundedAt: null,
            now: 1000000,
            delay,
          });
          expect(result).toBe(false);
        });
      });
    });

    describe('boundary test: elapsed exactly equals delay', () => {
      it('returns true for 1m at exactly 60_000ms', () => {
        const delay = '1m';
        const backgroundedAt = 0;
        const now = 60_000;

        const result = shouldAutoLock({
          backgroundedAt,
          now,
          delay,
        });

        expect(result).toBe(true);
      });

      it('returns true for 5m at exactly 300_000ms', () => {
        const delay = '5m';
        const backgroundedAt = 0;
        const now = 300_000;

        const result = shouldAutoLock({
          backgroundedAt,
          now,
          delay,
        });

        expect(result).toBe(true);
      });

      it('returns true for 15m at exactly 900_000ms', () => {
        const delay = '15m';
        const backgroundedAt = 0;
        const now = 900_000;

        const result = shouldAutoLock({
          backgroundedAt,
          now,
          delay,
        });

        expect(result).toBe(true);
      });
    });

    describe('boundary test: elapsed just before delay', () => {
      it('returns false for 1m at 59_999ms', () => {
        const result = shouldAutoLock({
          backgroundedAt: 0,
          now: 59_999,
          delay: '1m',
        });

        expect(result).toBe(false);
      });

      it('returns false for 5m at 299_999ms', () => {
        const result = shouldAutoLock({
          backgroundedAt: 0,
          now: 299_999,
          delay: '5m',
        });

        expect(result).toBe(false);
      });

      it('returns false for 15m at 899_999ms', () => {
        const result = shouldAutoLock({
          backgroundedAt: 0,
          now: 899_999,
          delay: '15m',
        });

        expect(result).toBe(false);
      });
    });

    describe('boundary test: elapsed just after delay', () => {
      it('returns true for 1m at 60_001ms', () => {
        const result = shouldAutoLock({
          backgroundedAt: 0,
          now: 60_001,
          delay: '1m',
        });

        expect(result).toBe(true);
      });

      it('returns true for 5m at 300_001ms', () => {
        const result = shouldAutoLock({
          backgroundedAt: 0,
          now: 300_001,
          delay: '5m',
        });

        expect(result).toBe(true);
      });

      it('returns true for 15m at 900_001ms', () => {
        const result = shouldAutoLock({
          backgroundedAt: 0,
          now: 900_001,
          delay: '15m',
        });

        expect(result).toBe(true);
      });
    });

    describe('immediately: zero delay', () => {
      it('returns true when elapsed is exactly 0', () => {
        const result = shouldAutoLock({
          backgroundedAt: 1000,
          now: 1000,
          delay: 'immediately',
        });

        expect(result).toBe(true);
      });

      it('returns true when elapsed is positive', () => {
        const result = shouldAutoLock({
          backgroundedAt: 1000,
          now: 1001,
          delay: 'immediately',
        });

        expect(result).toBe(true);
      });
    });

    describe('fail-safe: clock moved backwards', () => {
      it('returns true when now < backgroundedAt', () => {
        const result = shouldAutoLock({
          backgroundedAt: 2000,
          now: 1000,
          delay: '5m',
        });

        expect(result).toBe(true);
      });

      it('returns true for clock backwards on every delay', () => {
        const delays: AutoLockDelay[] = ['immediately', '1m', '5m', '15m'];

        delays.forEach((delay) => {
          const result = shouldAutoLock({
            backgroundedAt: 5000,
            now: 4000,
            delay,
          });
          expect(result).toBe(true);
        });
      });
    });
  });
});

describe('autoLockDelay.ts', () => {
  describe('autoLockDelayMs', () => {
    it.each<[AutoLockDelay, number]>([
      ['immediately', 0],
      ['1m', 60_000],
      ['5m', 300_000],
      ['15m', 900_000],
    ])('returns %s ms for %s', (delay, expectedMs) => {
      expect(autoLockDelayMs(delay)).toBe(expectedMs);
    });
  });

  describe('toAutoLockDelay', () => {
    describe('round-tripping valid delays', () => {
      it.each<AutoLockDelay>(['immediately', '1m', '5m', '15m'])(
        'returns %s unchanged',
        (delay) => {
          expect(toAutoLockDelay(delay)).toBe(delay);
        },
      );
    });

    describe('handling undefined (nothing stored yet)', () => {
      it('returns DEFAULT_AUTO_LOCK_DELAY when given undefined', () => {
        expect(toAutoLockDelay(undefined)).toBe(DEFAULT_AUTO_LOCK_DELAY);
      });

      it('DEFAULT_AUTO_LOCK_DELAY is 5m', () => {
        expect(DEFAULT_AUTO_LOCK_DELAY).toBe('5m');
      });
    });

    describe('rejecting removed or invalid values with fallback', () => {
      const invalidValues = [
        '30m', // plausible removed value
        '', // empty string
      ];

      it.each(invalidValues)(
        'returns DEFAULT_AUTO_LOCK_DELAY for "%s"',
        (invalidValue) => {
          expect(toAutoLockDelay(invalidValue)).toBe(DEFAULT_AUTO_LOCK_DELAY);
        },
      );
    });

    describe('prototype pollution defense', () => {
      const prototypeMembers = [
        'toString',
        'hasOwnProperty',
        'constructor',
        '__proto__',
      ];

      it.each(prototypeMembers)(
        'rejects Object.prototype.%s, returning DEFAULT_AUTO_LOCK_DELAY',
        (memberName) => {
          expect(toAutoLockDelay(memberName)).toBe(DEFAULT_AUTO_LOCK_DELAY);
        },
      );
    });
  });

  describe('describeAutoLock', () => {
    it('for immediately: "Locked when you left the app."', () => {
      expect(describeAutoLock('immediately')).toBe(
        'Locked when you left the app.',
      );
    });

    it('for 1m: "Locked after 1 minute in the background."', () => {
      expect(describeAutoLock('1m')).toBe(
        'Locked after 1 minute in the background.',
      );
    });

    it('for 5m: "Locked after 5 minutes in the background."', () => {
      expect(describeAutoLock('5m')).toBe(
        'Locked after 5 minutes in the background.',
      );
    });

    it('for 15m: "Locked after 15 minutes in the background."', () => {
      expect(describeAutoLock('15m')).toBe(
        'Locked after 15 minutes in the background.',
      );
    });

    it('all messages are distinct', () => {
      const messages = [
        describeAutoLock('immediately'),
        describeAutoLock('1m'),
        describeAutoLock('5m'),
        describeAutoLock('15m'),
      ];
      const uniqueMessages = new Set(messages);
      expect(uniqueMessages.size).toBe(4);
    });

    it('all messages are non-empty', () => {
      const delays: AutoLockDelay[] = ['immediately', '1m', '5m', '15m'];
      delays.forEach((delay) => {
        const message = describeAutoLock(delay);
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
