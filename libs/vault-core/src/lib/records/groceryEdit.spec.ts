import {
  setListLineChecked,
  setListLineAmount,
  deleteListLine,
  putListLine,
  createCatalogItemAndAddLine,
  uncheckAllListLines,
  removeCheckedListLines,
  createGroceryList,
  renameGroceryList,
  deleteGroceryList,
} from './groceryEdit';
import { mergeDeletionLogs, type VaultBlobEnvelope } from './vaultBlobEnvelope';
import { VAULT_BLOB_CONVERGE_STRATEGIES } from './vaultBlobConverge';
import type { CatalogItem, GroceryList, ListLine } from './grocery';

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

/** Count of lists. */
function listCount(envelope: VaultBlobEnvelope<unknown>): number {
  return payloadOf(envelope).lists.length;
}

/** Count of catalog items. */
function catalogCount(envelope: VaultBlobEnvelope<unknown>): number {
  return payloadOf(envelope).catalog.length;
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

  describe('createCatalogItemAndAddLine', () => {
    it('appends catalog item and line to existing catalog and list', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [
            {
              id: 'cat1',
              name: 'Milk',
              category: 'dairy',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
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

      const item: CatalogItem = {
        id: 'cat2',
        name: 'Bread',
        category: 'bakery',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line2',
        catalogItemId: 'cat2',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line);

      expect(catalogCount(result)).toBe(2);
      expect(payloadOf(result).catalog[1]).toBe(item);
      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(2);
      expect((list.lines as Record<string, unknown>[])[1]).toBe(line);
    });

    it('stamps the list updatedAt to line.updatedAt', () => {
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

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line);

      const list = listAt(result, 0);
      expect(list.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('preserves existing catalog items by reference', () => {
      const item1: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [item1],
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

      const item2: CatalogItem = {
        id: 'cat2',
        name: 'Bread',
        category: 'bakery',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat2',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item2, line);

      expect(payloadOf(result).catalog[0]).toBe(item1);
    });

    it('preserves existing lines by reference', () => {
      const line1 = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [line1],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const item: CatalogItem = {
        id: 'cat2',
        name: 'Bread',
        category: 'bakery',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line2: ListLine = {
        id: 'line2',
        catalogItemId: 'cat2',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line2);

      expect((listAt(result, 0).lines as Record<string, unknown>[])[0]).toBe(
        line1,
      );
    });

    it('preserves other lists by reference', () => {
      const list2 = {
        id: 'list2',
        name: 'Other',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
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
            list2,
          ],
        },
        deletions: {},
      };

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line);

      expect(listAt(result, 1)).toBe(list2);
    });

    it('treats missing catalog key as empty', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
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

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line);

      expect(catalogCount(result)).toBe(1);
      expect(payloadOf(result).catalog[0]).toBe(item);
    });

    it('preserves unknown keys', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              unknownListKey: 'preserved',
            },
          ],
          unknownPayloadKey: 'also-preserved',
        },
        deletions: {},
      };

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line);

      expect(listAt(result, 0).unknownListKey).toBe('preserved');
      expect(payloadOf(result).unknownPayloadKey).toBe('also-preserved');
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(
        envelope,
        'nonexistent',
        item,
        line,
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when payload is not a record', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {},
      };

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(
        envelope,
        'list1',
        item,
        line,
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
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions,
      };

      const item: CatalogItem = {
        id: 'cat1',
        name: 'Milk',
        category: 'dairy',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const line: ListLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createCatalogItemAndAddLine(envelope, 'list1', item, line);

      expect(result.deletions).toEqual(deletions);
    });
  });

  describe('uncheckAllListLines', () => {
    it('unchecks all checked lines on list', () => {
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
                {
                  id: 'line2',
                  catalogItemId: 'cat2',
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

      const result = uncheckAllListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      const line1 = (list.lines as Record<string, unknown>[])[0];
      const line2 = (list.lines as Record<string, unknown>[])[1];
      expect(line1.checked).toBe(false);
      expect(line2.checked).toBe(false);
    });

    it('stamps updatedAt on checked lines', () => {
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

      const result = uncheckAllListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      const line = lineAt(result, 0, 0);
      expect(line.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('leaves already-unchecked lines untouched by reference', () => {
      const uncheckedLine = {
        id: 'line1',
        catalogItemId: 'cat1',
        checked: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [uncheckedLine],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = uncheckAllListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(lineAt(result, 0, 0)).toBe(uncheckedLine);
    });

    it('never removes a line', () => {
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
                {
                  id: 'line2',
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

      const result = uncheckAllListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(2);
    });

    it('returns same envelope when nothing is checked (no-op)', () => {
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

      const result = uncheckAllListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = uncheckAllListLines(
        envelope,
        'nonexistent',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('preserves other lists by reference', () => {
      const list2 = {
        id: 'list2',
        name: 'Other',
        lines: [],
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
                  checked: true,
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

      const result = uncheckAllListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(listAt(result, 1)).toBe(list2);
    });
  });

  describe('removeCheckedListLines', () => {
    it('removes all checked lines from list', () => {
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
                {
                  id: 'line2',
                  catalogItemId: 'cat2',
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

      const result = removeCheckedListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(0);
    });

    it('leaves unchecked lines in place', () => {
      const uncheckedLine = {
        id: 'line2',
        catalogItemId: 'cat2',
        checked: false,
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
                  checked: true,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
                uncheckedLine,
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = removeCheckedListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      expect(list.lines).toHaveLength(1);
      expect((list.lines as Record<string, unknown>[])[0]).toBe(uncheckedLine);
    });

    it('writes deletion log entry for each removed line id', () => {
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
                {
                  id: 'line2',
                  catalogItemId: 'cat2',
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

      const result = removeCheckedListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result.deletions['line1']).toBe('2026-01-02T00:00:00.000Z');
      expect(result.deletions['line2']).toBe('2026-01-02T00:00:00.000Z');
    });

    it('does not touch catalog items', () => {
      const catalog = [
        { id: 'cat1', name: 'Milk' },
        { id: 'cat2', name: 'Bread' },
      ];
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

      const result = removeCheckedListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(payloadOf(result).catalog).toBe(catalog);
      expect(catalogCount(result)).toBe(2);
    });

    it('returns same envelope when nothing is checked (no-op)', () => {
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

      const result = removeCheckedListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = removeCheckedListLines(
        envelope,
        'nonexistent',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('preserves other lists by reference', () => {
      const list2 = {
        id: 'list2',
        name: 'Other',
        lines: [],
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
                  checked: true,
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

      const result = removeCheckedListLines(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(listAt(result, 1)).toBe(list2);
    });
  });

  describe('createGroceryList', () => {
    it('appends a new list to existing lists', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const newList: GroceryList = {
        id: 'list2',
        name: 'Bread Run',
        lines: [],
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createGroceryList(envelope, newList);

      expect(listCount(result)).toBe(2);
      expect(listAt(result, 1)).toBe(newList);
    });

    it('treats missing lists key as empty', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
        },
        deletions: {},
      };

      const newList: GroceryList = {
        id: 'list1',
        name: 'Milk Run',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const result = createGroceryList(envelope, newList);

      expect(listCount(result)).toBe(1);
      expect(listAt(result, 0)).toBe(newList);
    });

    it('returns same envelope when list with same id already exists (idempotent retry)', () => {
      const list1 = {
        id: 'list1',
        name: 'Milk Run',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [list1],
        },
        deletions: {},
      };

      const duplicateList: GroceryList = {
        id: 'list1',
        name: 'Different Name',
        lines: [],
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const result = createGroceryList(envelope, duplicateList);

      expect(result).toBe(envelope);
    });

    it('preserves catalog by reference', () => {
      const catalog = [{ id: 'cat1', name: 'Milk' }];
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog,
          lists: [],
        },
        deletions: {},
      };

      const newList: GroceryList = {
        id: 'list1',
        name: 'Milk Run',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const result = createGroceryList(envelope, newList);

      expect(payloadOf(result).catalog).toBe(catalog);
    });

    it('preserves other lists by reference', () => {
      const list1 = {
        id: 'list1',
        name: 'Milk Run',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [list1],
        },
        deletions: {},
      };

      const newList: GroceryList = {
        id: 'list2',
        name: 'Bread Run',
        lines: [],
        updatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      const result = createGroceryList(envelope, newList);

      expect(listAt(result, 0)).toBe(list1);
    });

    it('returns same envelope when payload is not a record', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {},
      };

      const newList: GroceryList = {
        id: 'list1',
        name: 'Milk Run',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const result = createGroceryList(envelope, newList);

      expect(result).toBe(envelope);
    });
  });

  describe('renameGroceryList', () => {
    it('changes only the list name and updatedAt', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Old Name',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat1',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'list1',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      expect(list.name).toBe('New Name');
      expect(list.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('preserves lines unchanged by reference', () => {
      const lines = [
        {
          id: 'line1',
          catalogItemId: 'cat1',
          checked: false,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Old Name',
              lines,
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'list1',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      expect((listAt(result, 0).lines as unknown[])).toBe(lines);
    });

    it('preserves other list fields unchanged', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Old Name',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
              unknownField: 'value',
            },
          ],
        },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'list1',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      const list = listAt(result, 0);
      expect(list.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(list.unknownField).toBe('value');
    });

    it('preserves catalog by reference', () => {
      const catalog = [{ id: 'cat1', name: 'Milk' }];
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog,
          lists: [
            {
              id: 'list1',
              name: 'Old Name',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'list1',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      expect(payloadOf(result).catalog).toBe(catalog);
    });

    it('preserves other lists by reference', () => {
      const list2 = {
        id: 'list2',
        name: 'Other',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Old Name',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            list2,
          ],
        },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'list1',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      expect(listAt(result, 1)).toBe(list2);
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'nonexistent',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when payload has no lists key', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: { catalog: [] },
        deletions: {},
      };

      const result = renameGroceryList(
        envelope,
        'list1',
        'New Name',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });
  });

  describe('deleteGroceryList', () => {
    it('removes the list from records.lists', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(listCount(result)).toBe(0);
    });

    it('writes deletion log entry for the list id only', () => {
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
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result.deletions['list1']).toBe('2026-01-02T00:00:00.000Z');
      expect(result.deletions['line1']).toBeUndefined();
    });

    it('does not touch catalog', () => {
      const catalog = [
        { id: 'cat1', name: 'Milk' },
        { id: 'cat2', name: 'Bread' },
      ];
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
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(payloadOf(result).catalog).toBe(catalog);
      expect(catalogCount(result)).toBe(2);
    });

    it('preserves other lists by reference', () => {
      const list2 = {
        id: 'list2',
        name: 'Other',
        lines: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            list2,
          ],
        },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(listAt(result, 0)).toBe(list2);
    });

    it('returns same envelope when listId not found', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [],
        },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'nonexistent',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('returns same envelope when payload has no lists key', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: { catalog: [] },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(result).toBe(envelope);
    });

    it('preserves catalog items even when only referenced by deleted list', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [
            { id: 'cat1', name: 'Milk' },
            { id: 'cat-orphan', name: 'Orphan' },
          ],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [
                {
                  id: 'line1',
                  catalogItemId: 'cat-orphan',
                  checked: false,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {},
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(catalogCount(result)).toBe(2);
      expect(
        (payloadOf(result).catalog[1] as Record<string, unknown>).name,
      ).toBe('Orphan');
    });

    it('keeps existing deletion log entries and keeps newer instant when entry already exists', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: {
          catalog: [],
          lists: [
            {
              id: 'list1',
              name: 'Milk Run',
              lines: [],
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        deletions: {
          existingId: '2026-01-01T00:00:00.000Z',
          list1: '2026-01-01T00:00:00.000Z',
        },
      };

      const result = deleteGroceryList(
        envelope,
        'list1',
        '2026-01-03T00:00:00.000Z',
      );

      expect(result.deletions['existingId']).toBe('2026-01-01T00:00:00.000Z');
      expect(result.deletions['list1']).toBe('2026-01-03T00:00:00.000Z');
    });
  });
});
