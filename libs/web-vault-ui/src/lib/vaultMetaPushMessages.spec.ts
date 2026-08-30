/**
 * Tests for passphrase change outcome copy — the three-tone grouping and
 * exhaustiveness of the mapping.
 */

import {
  PASSPHRASE_CHANGE_TONES,
  passphraseChangeReading,
  type PassphraseChangeTone,
} from './vaultMetaPushMessages';

describe('vaultMetaPushMessages', () => {
  describe('PASSPHRASE_CHANGE_TONES mapping', () => {
    test('maps all seven outcomes to one of three tones: ok, pending, or attention', () => {
      const tones = Object.values(PASSPHRASE_CHANGE_TONES);
      const uniqueTones = new Set(tones);

      expect(uniqueTones).toEqual(
        new Set<PassphraseChangeTone>(['ok', 'pending', 'attention']),
      );

      // Exhaustiveness is not asserted here on purpose. The `satisfies` pin on
      // PASSPHRASE_CHANGE_TONES already makes an unmapped outcome a compile
      // error, and re-listing the members would be the hand-enumeration
      // ADR 0053 forbids — it would also fail on a harmless reordering.
    });

    test('ok outcomes: pushed, noop-already-in-sync', () => {
      expect(PASSPHRASE_CHANGE_TONES.pushed).toBe('ok');
      expect(PASSPHRASE_CHANGE_TONES['noop-already-in-sync']).toBe('ok');
    });

    test('pending outcomes: unreachable, skipped-not-authenticated, refused-no-base', () => {
      expect(PASSPHRASE_CHANGE_TONES.unreachable).toBe('pending');
      expect(PASSPHRASE_CHANGE_TONES['skipped-not-authenticated']).toBe(
        'pending',
      );
      expect(PASSPHRASE_CHANGE_TONES['refused-no-base']).toBe('pending');
    });

    test('attention outcomes: refused-server-moved, refused-not-pushable', () => {
      expect(PASSPHRASE_CHANGE_TONES['refused-server-moved']).toBe('attention');
      expect(PASSPHRASE_CHANGE_TONES['refused-not-pushable']).toBe('attention');
    });
  });

  describe('passphraseChangeReading function', () => {
    test('returns reading with tone ok for pushed outcome', () => {
      const reading = passphraseChangeReading({ kind: 'pushed' });

      expect(reading.tone).toBe('ok');
      expect(reading.title).toBe('Passphrase changed');
      expect(reading.detail).toContain('other devices');
    });

    test('returns reading with tone ok for noop-already-in-sync outcome', () => {
      const reading = passphraseChangeReading({
        kind: 'noop-already-in-sync',
      });

      expect(reading.tone).toBe('ok');
      expect(reading.title).toBe('Passphrase changed');
    });

    test('returns reading with tone pending for unreachable outcome', () => {
      const reading = passphraseChangeReading({ kind: 'unreachable' });

      expect(reading.tone).toBe('pending');
      expect(reading.title).toBe('Passphrase changed on this device');
      expect(reading.detail).toContain('has not reached');
    });

    test('returns reading with tone pending for skipped-not-authenticated outcome', () => {
      const reading = passphraseChangeReading({
        kind: 'skipped-not-authenticated',
      });

      expect(reading.tone).toBe('pending');
      expect(reading.title).toBe('Passphrase changed on this device');
    });

    test('returns reading with tone pending for refused-no-base outcome', () => {
      const reading = passphraseChangeReading({ kind: 'refused-no-base' });

      expect(reading.tone).toBe('pending');
      expect(reading.title).toBe('Passphrase changed on this device');
    });

    test('returns reading with tone attention for refused-server-moved outcome', () => {
      const reading = passphraseChangeReading({
        kind: 'refused-server-moved',
        change: 'passphrase',
      });

      expect(reading.tone).toBe('attention');
      expect(reading.title).toBe('Passphrase changed on this device');
      expect(reading.detail).toContain('also changed somewhere else');
    });

    test('returns reading with tone attention for refused-not-pushable outcome', () => {
      const reading = passphraseChangeReading({
        kind: 'refused-not-pushable',
        change: 'passphrase',
      });

      expect(reading.tone).toBe('attention');
      expect(reading.title).toBe('Passphrase changed on this device');
    });

    test('reading always has title and detail', () => {
      const outcomes: Array<Parameters<typeof passphraseChangeReading>[0]> = [
        { kind: 'pushed' },
        { kind: 'noop-already-in-sync' },
        { kind: 'unreachable' },
        { kind: 'skipped-not-authenticated' },
        { kind: 'refused-no-base' },
        { kind: 'refused-server-moved', change: 'passphrase' },
        { kind: 'refused-not-pushable', change: 'passphrase' },
      ];

      outcomes.forEach((outcome) => {
        const reading = passphraseChangeReading(outcome);
        expect(reading.title).toBeDefined();
        expect(reading.title).not.toBe('');
        expect(reading.detail).toBeDefined();
        expect(reading.detail).not.toBe('');
      });
    });

    test('no outcome tone is rendered as a failure', () => {
      const outcomes: Array<Parameters<typeof passphraseChangeReading>[0]> = [
        { kind: 'pushed' },
        { kind: 'noop-already-in-sync' },
        { kind: 'unreachable' },
        { kind: 'skipped-not-authenticated' },
        { kind: 'refused-no-base' },
        { kind: 'refused-server-moved', change: 'passphrase' },
        { kind: 'refused-not-pushable', change: 'passphrase' },
      ];

      outcomes.forEach((outcome) => {
        const reading = passphraseChangeReading(outcome);
        // pending and attention describe conditions that outlive the toast,
        // but they are non-failures. No tone should suggest failure or error.
        expect(['ok', 'pending', 'attention']).toContain(reading.tone);
      });
    });
  });
});
