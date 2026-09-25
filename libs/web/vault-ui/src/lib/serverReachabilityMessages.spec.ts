/**
 * Tests for server reachability reading messages — the three-state mapping
 * and exhaustiveness of the readings table.
 */

import {
  SERVER_REACHABILITY_READINGS,
  serverReachabilityReading,
  type ServerReachabilityTone,
} from './serverReachabilityMessages';

describe('serverReachabilityMessages', () => {
  describe('SERVER_REACHABILITY_READINGS table exhaustiveness', () => {
    test('every entry in the readings table has a valid shape', () => {
      // The real exhaustiveness guard lives in the implementation: the
      // `as const satisfies Record<ServerReachability, ServerReachabilityReading>`
      // on the table fails to compile if a fourth state is added without an entry.
      // This test's job is the complementary one the type cannot do — catching
      // an entry that exists but was left half-written.
      const validTones: ServerReachabilityTone[] = ['ok', 'attention'];

      Object.entries(SERVER_REACHABILITY_READINGS).forEach(([, reading]) => {
        // Tone must be one of the valid values
        expect(validTones).toContain(reading.tone);

        // Label and detail must both be null or both be non-empty strings
        // (never one of each, and never an empty string)
        const labelIsNull = reading.label === null;
        const detailIsNull = reading.detail === null;

        expect(labelIsNull).toBe(detailIsNull);

        if (reading.label !== null) {
          expect(reading.label).not.toBe('');
          expect(typeof reading.label).toBe('string');
        }

        if (reading.detail !== null) {
          expect(reading.detail).not.toBe('');
          expect(typeof reading.detail).toBe('string');
        }

        // canRecheck must be a boolean
        expect(typeof reading.canRecheck).toBe('boolean');
      });
    });

    test('reachable reading has null label and null detail', () => {
      const reading = SERVER_REACHABILITY_READINGS.reachable;

      expect(reading.label).toBeNull();
      expect(reading.detail).toBeNull();
      // Explicitly assert this: it is the behavior that keeps the notice
      // from making a promise it cannot keep — an affirmative "server
      // reachable" would promise the next write will land, which no reading can.
      expect(reading.tone).toBe('ok');
      expect(reading.canRecheck).toBe(false);
    });

    test('unreachable reading has non-null label and detail with canRecheck true', () => {
      const reading = SERVER_REACHABILITY_READINGS.unreachable;

      expect(reading.label).not.toBeNull();
      expect(reading.detail).not.toBeNull();
      expect(reading.tone).toBe('attention');
      expect(reading.canRecheck).toBe(true);
    });

    test('signed-out reading has non-null label and detail with canRecheck false', () => {
      const reading = SERVER_REACHABILITY_READINGS['signed-out'];

      expect(reading.label).not.toBeNull();
      expect(reading.detail).not.toBeNull();
      expect(reading.tone).toBe('attention');
      // canRecheck is false for session-ended: the repair is signing in,
      // which happens elsewhere, and a button that re-checks something the
      // User cannot have changed teaches them the button does not work.
      expect(reading.canRecheck).toBe(false);
    });
  });

  describe('warning details mention rotation can proceed', () => {
    test('unreachable detail contains "You can still rotate now"', () => {
      const reading = SERVER_REACHABILITY_READINGS.unreachable;

      // This is load-bearing copy: a warning sitting immediately above a
      // confirm button reads as a stop sign unless it says otherwise, and
      // stopping is the wrong move — the new key works on this device the
      // moment it is written, whatever the server can be reached to do.
      expect(reading.detail).toContain('You can still rotate now');
    });

    test('signed-out detail contains "You can still rotate now"', () => {
      const reading = SERVER_REACHABILITY_READINGS['signed-out'];

      expect(reading.detail).toContain('You can still rotate now');
    });
  });

  describe('serverReachabilityReading() function', () => {
    test('null reachability reads as reachable (no checking state shown)', () => {
      const reading = serverReachabilityReading(null);

      // Null means no reading has resolved yet. It reads as reachable does,
      // showing nothing, rather than as a "checking" state: a spinner
      // immediately above a confirm button tells a User to wait for it,
      // and waiting is precisely what this must never ask for.
      expect(reading.label).toBeNull();
      expect(reading.detail).toBeNull();
      expect(reading.tone).toBe('ok');
    });

    test('reachable returns the reachable reading', () => {
      const reading = serverReachabilityReading('reachable');

      expect(reading).toEqual(SERVER_REACHABILITY_READINGS.reachable);
    });

    test('unreachable returns the unreachable reading', () => {
      const reading = serverReachabilityReading('unreachable');

      expect(reading).toEqual(SERVER_REACHABILITY_READINGS.unreachable);
    });

    test('signed-out returns the signed-out reading', () => {
      const reading = serverReachabilityReading('signed-out');

      expect(reading).toEqual(SERVER_REACHABILITY_READINGS['signed-out']);
    });
  });
});
