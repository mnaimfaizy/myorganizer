/**
 * Tests for VAULT_ABSENT_EVIDENCE_GATE_VIEWS mapping.
 *
 * Verifies exhaustiveness (every VaultAbsentEvidence kind has a view),
 * correct status resolutions, and proper handling of all outcomes.
 */

import { VAULT_ABSENT_EVIDENCE_GATE_VIEWS } from './vaultAbsentEvidenceGateView';
import type { VaultAbsentEvidence } from '@myorganizer/web-vault';

// Derive kinds from the type definition
const RESULT_KINDS = [
  'no-server-vault',
  'server-holds-vault',
  'postponed',
  'session-lost',
] as const;

describe('VAULT_ABSENT_EVIDENCE_GATE_VIEWS', () => {
  test('every result kind has a corresponding view entry', () => {
    for (const kind of RESULT_KINDS) {
      expect(VAULT_ABSENT_EVIDENCE_GATE_VIEWS).toHaveProperty(kind);
    }
  });

  test('only known result kinds exist in the map (exhaustiveness)', () => {
    const mappedKinds = Object.keys(
      VAULT_ABSENT_EVIDENCE_GATE_VIEWS,
    ) as VaultAbsentEvidence['kind'][];

    const sortedMapped = [...mappedKinds].sort();
    const sortedExpected = [...RESULT_KINDS].sort();

    expect(sortedMapped).toEqual(sortedExpected);
  });

  test('no-server-vault resolves to vault-status absent', () => {
    const view = VAULT_ABSENT_EVIDENCE_GATE_VIEWS['no-server-vault'];
    expect(view).toEqual({ kind: 'vault-status', status: 'absent' });
  });

  test('server-holds-vault resolves to awaiting-download with title and description', () => {
    const view = VAULT_ABSENT_EVIDENCE_GATE_VIEWS['server-holds-vault'];
    expect(view.kind).toBe('awaiting-download');
    if (view.kind === 'awaiting-download') {
      expect(view.title).toBe('Getting your vault back');
      expect(view.description).toBe(
        'The server already holds a vault for your account. This device is bringing it back — this is not the moment to create a new one.',
      );
    }
  });

  test('postponed resolves to cannot-check with title and description', () => {
    const view = VAULT_ABSENT_EVIDENCE_GATE_VIEWS.postponed;
    expect(view.kind).toBe('cannot-check');
    if (view.kind === 'cannot-check') {
      expect(view.title).toBe('We could not reach the server');
      expect(view.description).toBe(
        'Checking for your vault needs the server, and we could not reach it. Nothing here was changed, and we will try again when you are back online.',
      );
    }
  });

  test('session-lost resolves to cannot-check with title and description', () => {
    const view = VAULT_ABSENT_EVIDENCE_GATE_VIEWS['session-lost'];
    expect(view.kind).toBe('cannot-check');
    if (view.kind === 'cannot-check') {
      expect(view.title).toBe('Please sign in again');
      expect(view.description).toBe(
        'Your session ended before we could check for your vault. Nothing here was changed.',
      );
    }
  });

  test('postponed and session-lost have distinct messages', () => {
    const postponedView = VAULT_ABSENT_EVIDENCE_GATE_VIEWS.postponed;
    const sessionLostView = VAULT_ABSENT_EVIDENCE_GATE_VIEWS['session-lost'];

    expect(postponedView.kind).toBe('cannot-check');
    expect(sessionLostView.kind).toBe('cannot-check');

    if (
      postponedView.kind === 'cannot-check' &&
      sessionLostView.kind === 'cannot-check'
    ) {
      // Both should be distinct
      expect(postponedView.title).not.toBe(sessionLostView.title);
      expect(postponedView.description).not.toBe(sessionLostView.description);
    }
  });

  test('server-holds-vault and postponed have distinct messages', () => {
    const serverHoldsView =
      VAULT_ABSENT_EVIDENCE_GATE_VIEWS['server-holds-vault'];
    const postponedView = VAULT_ABSENT_EVIDENCE_GATE_VIEWS.postponed;

    expect(serverHoldsView.kind).toBe('awaiting-download');
    expect(postponedView.kind).toBe('cannot-check');

    if (
      serverHoldsView.kind === 'awaiting-download' &&
      postponedView.kind === 'cannot-check'
    ) {
      // Both are withheld screens but with different messages
      expect(serverHoldsView.title).not.toBe(postponedView.title);
      expect(serverHoldsView.description).not.toBe(postponedView.description);
    }
  });
});
