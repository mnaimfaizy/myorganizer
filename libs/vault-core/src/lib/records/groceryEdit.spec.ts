import {
  setListLineChecked,
  setListLineAmount,
  deleteListLine,
  putListLine,
} from './groceryEdit';
import { mergeDeletionLogs, type VaultBlobEnvelope } from './vaultBlobEnvelope';
import { VAULT_BLOB_CONVERGE_STRATEGIES } from './vaultBlobConverge';
import type { ListLine } from './grocery';

interface TestPayload extends Record<string, unknown> {
  catalog: unknown[];
  lists: Record<string, unknown>[];
}

/** The records half of an envelope, read as the groceries payload it is. */
function payloadOf(envelope: VaultBlobEnvelope<unknown>): TestPayload {
  return envelope.records as TestPayload;
}

/** One line of one list, by position. */
function lineAt(
  envelope: VaultBlobEnvelope<unknown>,
  listIndex: number,
  lineIndex: number,
): Record<string, unknown> {
  const lines = payloadOf(envelope).lists[listIndex].lines as Record<
    string,
    unknown
  >[];
  return lines[lineIndex];
}

/** One list by position. */
function listAt(
  envelope: VaultBlobEnvelope<unknown>,
  listIndex: number,
): Record<string, unknown> {
  return payloadOf(envelope).lists[listIndex] as Record<string, unknown>;
}

describe('groceryEdit', () => {
  describe('setListLineChecked', () => {
    it('checks an unchecked line and stamps its updatedAt', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      const list = (result.records as { lists: unknown[] }).lists[0] as {
        lines: Array<{ id: string; checked: boolean; updatedAt: string }>;
      };
      expect(list.lines[0].checked).toBe(true);
      expect(list.lines[0].updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('unchecks a checked line', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: true,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        false,
        '2026-01-02T00:00:00.000Z',
      );

      const list = (result.records as { lists: unknown[] }).lists[0] as {
        lines: Array<{ id: string; checked: boolean }>;
      };
      expect(list.lines[0].checked).toBe(false);
    });

    it('stamps the owning list updatedAt', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      const list = (result.records as { lists: unknown[] }).lists[0] as {
        updatedAt: string;
      };
      expect(list.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('preserves catalog by reference', () => {
      const catalog = [{ id: 'cat1', name: 'Milk' }];
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog,
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      expect(payloadOf(result).catalog).toBe(catalog);
    });

    it('leaves other lists untouched by reference', () => {
      const list2 = {
        id: 'list2',
        name: 'Other',
        lines: [
          {
            id: 'line2',
            catalogItemId: 'cat2',
            checked: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            list2,
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      const lists = payloadOf(result).lists;
      expect(lists[1]).toBe(list2);
    });

    it('preserves unknown keys on line, list, and payload', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              unknownListKey: 'preserved',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                  unknownLineKey: 'also-preserved',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          unknownPayloadKey: 'still-here',
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      const line = lineAt(result, 0, 0);
      expect(list.unknownListKey).toBe('preserved');
      expect(line.unknownLineKey).toBe('also-preserved');
      expect(payloadOf(result).unknownPayloadKey).toBe('still-here');
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'nonexistent',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when lineId not found on list', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'nonexistent',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when payload has no lists key', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: { catalog: [] },
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when payload is a bare array', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {},
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('carries deletion log unchanged', () => {
      const deletions = { oldId: '2026-01-01T00:00:00.000Z' };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions,
      };

      const result = setListLineChecked(
        envelope,
        'list1',
        'line1',
        true,
        '2026-01-02T00:00:00.000Z',
      );

      expect(result.deletions).toEqual(deletions);
    });
  });

  describe('setListLineAmount', () => {
    it('sets a trimmed amount and stamps updatedAt', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'list1',
        'line1',
        '  2 liters  ',
        '2026-01-02T00:00:00.000Z',
      );

      const line = lineAt(result, 0, 0);
      expect(line.amount).toBe('2 liters');
      expect(line.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('replaces an existing amount', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  amount: 'old',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'list1',
        'line1',
        'new',
        '2026-01-02T00:00:00.000Z',
      );

      const line = lineAt(result, 0, 0);
      expect(line.amount).toBe('new');
    });

    it('removes amount when given undefined', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  amount: 'old',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'list1',
        'line1',
        undefined,
        '2026-01-02T00:00:00.000Z',
      );

      const line = lineAt(result, 0, 0);
      expect('amount' in line).toBe(false);
    });

    it('removes amount when given empty string', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  amount: 'old',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'list1',
        'line1',
        '',
        '2026-01-02T00:00:00.000Z',
      );

      const line = lineAt(result, 0, 0);
      expect('amount' in line).toBe(false);
    });

    it('removes amount when given whitespace-only string', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  amount: 'old',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'list1',
        'line1',
        '   ',
        '2026-01-02T00:00:00.000Z',
      );

      const line = lineAt(result, 0, 0);
      expect('amount' in line).toBe(false);
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'nonexistent',
        'line1',
        'amount',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when lineId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = setListLineAmount(
        envelope,
        'list1',
        'nonexistent',
        'amount',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });
  });

  describe('deleteListLine', () => {
    it('removes the line from that list only', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteListLine(
        envelope,
        'list1',
        'line1',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(0);
    });

    it('writes deletion entry for the line id', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteListLine(
        envelope,
        'list1',
        'line1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result.deletions['line1']).toBe('2026-01-02T00:00:00.000Z');
    });

    it('does not write deletion entry for catalogItemId', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [{ id: 'cat1', name: 'Milk' }],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteListLine(
        envelope,
        'list1',
        'line1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result.deletions['cat1']).toBeUndefined();
      expect(payloadOf(result).catalog).toHaveLength(1);
    });

    it('keeps existing deletion log entries and keeps newer instant when entry already exists', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {
          existingId: '2026-01-01T00:00:00.000Z',
          line1: '2026-01-01T00:00:00.000Z',
        },
      };

      const result = deleteListLine(
        envelope,
        'list1',
        'line1',
        '2026-01-03T00:00:00.000Z',
      );

      expect(result.deletions['existingId']).toBe('2026-01-01T00:00:00.000Z');
      expect(result.deletions['line1']).toBe('2026-01-03T00:00:00.000Z');
    });

    it('does not remove line with same id on another list', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'list2',
              name: 'Other',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat2',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteListLine(
        envelope,
        'list1',
        'line1',
        '2026-01-02T00:00:00.000Z',
      );

      const list2 = listAt(result, 1);
      expect(list2.lines).toHaveLength(1);
      expect((list2.lines as Record<string, unknown>[])[0].id).toBe('line1');
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = deleteListLine(
        envelope,
        'nonexistent',
        'line1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
      expect(result.deletions['line1']).toBeUndefined();
    });

    it('returns same envelope when lineId not found on list', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteListLine(
        envelope,
        'list1',
        'nonexistent',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });
  });

  describe('putListLine', () => {
    it('appends a line that is not there', () => {
      const line: ListLine = {
        id: 'line2',
        catalogItemId: 'cat2',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = putListLine(envelope, 'list1', line);

      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(2);
      expect((list.lines as Record<string, unknown>[])[1]).toBe(line);
      expect(list.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('replaces in place a line whose id already exists', () => {
      const oldLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const newLine: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: true,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [oldLine],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = putListLine(envelope, 'list1', newLine);

      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(1);
      expect((list.lines as Record<string, unknown>[])[0]).toBe(newLine);
    });

    it('returns same envelope when listId not found', () => {
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = putListLine(envelope, 'nonexistent', line);

      expect(result).toBe(envelope);
    });
  });

  describe('undo round trip with deletion log merging', () => {
    it('no production grocery merge: Groceries use promptOnConflict strategy, not union-by-id', () => {
      expect(VAULT_BLOB_CONVERGE_STRATEGIES.groceries.strategy).toBe(
        'promptOnConflict',
      );
    });

    it('deletion log + line mutation preserve re-added state under any union-by-id merge', () => {
      // Groceries converge by promptOnConflict, not by mergeById. This test simulates
      // what a union-by-id merge would do to verify that deleteListLine records the
      // deletion properly and putListLine restores the line correctly — properties
      // the Deletion Log leverages if any hypothetical merge ever did union by id.

      // Start: a line on the list
      let envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [{ id: 'cat1', name: 'Milk' }],
          lists: [
            {
              id: 'list1',
              name: 'Trip 1',
              lines: [
                {
                  id: 'line-original',
                  catalogItemId: 'cat1',
                  checked: false,
                  amount: '2L',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      // Delete the line
      envelope = deleteListLine(
        envelope,
        'list1',
        'line-original',
        '2026-01-02T00:00:00.000Z',
      );

      // Undo: put back a fresh line with the same catalogItemId, amount, and checked state
      const newLine: ListLine = {
        id: 'line-undo-' + Date.now(),
        catalogItemId: 'cat1',
        checked: false,
        amount: '2L',
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };
      envelope = putListLine(envelope, 'list1', newLine);

      // Assert the new line is present with expected values
      const list = listAt(envelope, 0);
      expect(list.lines).toHaveLength(1);
      const line = (list.lines as Record<string, unknown>[])[0];
      expect(line.catalogItemId).toBe('cat1');
      expect(line.amount).toBe('2L');
      expect(line.checked).toBe(false);
      expect(line.id).toBe(newLine.id);

      // Assert the deleted line is in the deletion log
      expect(envelope.deletions['line-original']).toBe(
        '2026-01-02T00:00:00.000Z',
      );
      expect(envelope.deletions[newLine.id]).toBeUndefined();

      // Simulate a union-by-id merge (to test that Deletion Log works correctly):
      // union by id, drop anything in merged deletion log. This represents merging with
      // a stale copy that still has the deleted line.
      const staleEnvelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [{ id: 'cat1', name: 'Milk' }],
          lists: [
            {
              id: 'list1',
              name: 'Trip 1',
              lines: [
                {
                  id: 'line-original',
                  catalogItemId: 'cat1',
                  checked: false,
                  amount: '2L',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      // Merge deletion logs
      const mergedDeletions = mergeDeletionLogs(
        envelope.deletions,
        staleEnvelope.deletions,
      );

      // Union lines by id
      const allLines: Record<string, unknown>[] = [
        ...(listAt(envelope, 0).lines as Record<string, unknown>[]),
        ...(listAt(staleEnvelope, 0).lines as Record<string, unknown>[]),
      ];
      const byId = new Map<string, Record<string, unknown>>();
      for (const line of allLines) {
        const id = line.id;
        if (typeof id === 'string') {
          byId.set(id, line);
        }
      }

      // Drop anything in merged deletion log
      const finalLines = Array.from(byId.values()).filter((l) => {
        const id = l.id;
        return typeof id === 'string' ? !mergedDeletions[id] : true;
      });

      // Assert: the old line is buried by the Deletion Log, the new one survives.
      // This would fail if deleteListLine did not record the deletion entry, because
      // then the stale old line would not be filtered out.
      expect(finalLines).toHaveLength(1);
      expect(finalLines[0].id).toBe(newLine.id);
      expect(mergedDeletions['line-original']).toBe('2026-01-02T00:00:00.000Z');
    });
  });
});
