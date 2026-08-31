/**
 * Tests for VAULT_CLAIM_EVIDENCE_GATE_VIEWS mapping.
 *
 * Verifies exhaustiveness (every VaultClaimOnEvidenceResult kind has a view),
 * correct status resolutions, and proper handling of unreachable outcomes.
 */

import { VAULT_CLAIM_EVIDENCE_GATE_VIEWS } from './vaultClaimEvidenceGateView';
import type { VaultClaimOnEvidenceResult } from '@myorganizer/web-vault';

// Import VAULT_META_CHANGES to get the list of all possible result kinds
// We derive the kinds from VaultClaimOnEvidenceResult type
const RESULT_KINDS = [
  'claimed',
  'refused-not-this-vault',
  'no-evidence',
  'postponed',
  'replace-offer',
  'session-lost',
  'skipped-already-owned',
  'skipped-nothing-to-claim',
] as const;

describe('VAULT_CLAIM_EVIDENCE_GATE_VIEWS', () => {
  test('1: every result kind has a corresponding view entry', () => {
    for (const kind of RESULT_KINDS) {
      expect(VAULT_CLAIM_EVIDENCE_GATE_VIEWS).toHaveProperty(kind);
    }
  });

  test('2: only known result kinds exist in the map (exhaustiveness)', () => {
    const mappedKinds = Object.keys(
      VAULT_CLAIM_EVIDENCE_GATE_VIEWS,
    ) as VaultClaimOnEvidenceResult['kind'][];

    const sortedMapped = [...mappedKinds].sort();
    const sortedExpected = [...RESULT_KINDS].sort();

    expect(sortedMapped).toEqual(sortedExpected);
  });

  test('3: claimed resolves to vault-status owned', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS.claimed;
    expect(view).toEqual({ kind: 'vault-status', status: 'owned' });
  });

  test('4: skipped-already-owned resolves to vault-status owned', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['skipped-already-owned'];
    expect(view).toEqual({ kind: 'vault-status', status: 'owned' });
  });

  test('5: refused-not-this-vault resolves to vault-status absent', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['refused-not-this-vault'];
    expect(view).toEqual({ kind: 'vault-status', status: 'absent' });
  });

  test('6: no-evidence resolves to vault-status absent', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['no-evidence'];
    expect(view).toEqual({ kind: 'vault-status', status: 'absent' });
  });

  test('7: skipped-nothing-to-claim resolves to vault-status absent', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['skipped-nothing-to-claim'];
    expect(view).toEqual({ kind: 'vault-status', status: 'absent' });
  });

  test('8: postponed resolves to cannot-check with title and description', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS.postponed;
    expect(view.kind).toBe('cannot-check');
    if (view.kind === 'cannot-check') {
      expect(view.title).toBeTruthy();
      expect(typeof view.title).toBe('string');
      expect(view.description).toBeTruthy();
      expect(typeof view.description).toBe('string');
    }
  });

  test('9: replace-offer resolves to replace-offer kind', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['replace-offer'];
    expect(view).toEqual({ kind: 'replace-offer' });
  });

  test('10: session-lost resolves to cannot-check with title and description', () => {
    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['session-lost'];
    expect(view.kind).toBe('cannot-check');
    if (view.kind === 'cannot-check') {
      expect(view.title).toBeTruthy();
      expect(typeof view.title).toBe('string');
      expect(view.description).toBeTruthy();
      expect(typeof view.description).toBe('string');
    }
  });

  test('11: postponed and session-lost have distinct messages', () => {
    const postponedView = VAULT_CLAIM_EVIDENCE_GATE_VIEWS.postponed;
    const sessionLostView = VAULT_CLAIM_EVIDENCE_GATE_VIEWS['session-lost'];

    if (
      postponedView.kind === 'cannot-check' &&
      sessionLostView.kind === 'cannot-check'
    ) {
      // Both should be distinct
      expect(postponedView.title).not.toBe(sessionLostView.title);
      expect(postponedView.description).not.toBe(sessionLostView.description);
    }
  });
});
