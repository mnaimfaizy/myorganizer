import { isTabName, TAB_NAMES, TabName, DEFAULT_TAB } from './tabs';

describe('isTabName', () => {
  describe('accepting valid tab names', () => {
    it.each<TabName>(TAB_NAMES)('accepts %s', (tabName) => {
      expect(isTabName(tabName)).toBe(true);
    });
  });

  describe('rejecting invalid strings', () => {
    const staleAndInvalidNames = [
      'Vault', // plausible stale name from earlier design
      'tasks', // case mismatch: Tasks is correct
      'Tasks ', // trailing whitespace
      '', // empty string
    ];

    it.each(staleAndInvalidNames)('rejects "%s"', (invalidName) => {
      expect(isTabName(invalidName)).toBe(false);
    });
  });

  describe('rejecting null and undefined', () => {
    it('rejects null', () => {
      expect(isTabName(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isTabName(undefined)).toBe(false);
    });
  });

  describe('prototype pollution defense', () => {
    const prototypeMembers = [
      'toString',
      'constructor',
      'hasOwnProperty',
      '__proto__',
    ];

    it.each(prototypeMembers)('rejects Object.prototype.%s', (memberName) => {
      expect(isTabName(memberName)).toBe(false);
    });
  });

  describe('DEFAULT_TAB invariant', () => {
    it('DEFAULT_TAB is a valid tab name', () => {
      expect(isTabName(DEFAULT_TAB)).toBe(true);
    });
  });

  describe('TAB_NAMES structure', () => {
    it('contains no duplicates', () => {
      const unique = new Set(TAB_NAMES);
      expect(unique.size).toBe(TAB_NAMES.length);
    });
  });
});
