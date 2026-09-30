import { toAppearance, Appearance, DEFAULT_APPEARANCE } from './appearance';

describe('toAppearance', () => {
  describe('round-tripping valid appearance values', () => {
    it.each<Appearance>(['system', 'light', 'dark'])(
      'returns %s unchanged',
      (appearance) => {
        expect(toAppearance(appearance)).toBe(appearance);
      },
    );
  });

  describe('handling undefined (nothing stored yet)', () => {
    it('returns DEFAULT_APPEARANCE when given undefined', () => {
      expect(toAppearance(undefined)).toBe(DEFAULT_APPEARANCE);
    });

    it('DEFAULT_APPEARANCE is "system"', () => {
      expect(DEFAULT_APPEARANCE).toBe('system');
    });
  });

  describe('rejecting invalid strings with fallback', () => {
    const invalidAppearances = [
      'auto', // plausible removed value
      'Light', // case mismatch: light is correct
      '', // empty string
    ];

    it.each(invalidAppearances)(
      'returns DEFAULT_APPEARANCE for "%s"',
      (invalidValue) => {
        expect(toAppearance(invalidValue)).toBe(DEFAULT_APPEARANCE);
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
      'rejects Object.prototype.%s, returning DEFAULT_APPEARANCE',
      (memberName) => {
        expect(toAppearance(memberName)).toBe(DEFAULT_APPEARANCE);
      },
    );
  });

  describe('return value invariant', () => {
    const testInputs = [
      'system',
      'light',
      'dark',
      undefined,
      'auto',
      'Light',
      '',
      'toString',
      'constructor',
    ];

    it.each(testInputs)(
      'always returns a valid Appearance for input %j',
      (input) => {
        const result = toAppearance(input as string | undefined);
        expect(['system', 'light', 'dark']).toContain(result);
      },
    );
  });
});
