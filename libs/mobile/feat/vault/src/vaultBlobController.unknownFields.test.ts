// The mobile push path must put back every field a client does not know
// (ADR 0114 decision 3): on a record, on a nested Usage Location, on a
// Grocery payload, and on the envelope around the records. The body the
// server receives is what is asserted here, so the bytes on the wire are the
// contract, not the controller's own copy of them.
jest.mock('./crypto', () => {
  const bytes = jest.requireActual('./bytes');
  return {
    ...bytes,
    mobileVaultCrypto: {
      aesGcmDecrypt: async ({ ciphertext }: { ciphertext: Uint8Array }) =>
        ciphertext,
      aesGcmEncrypt: async ({ plaintext }: { plaintext: Uint8Array }) =>
        plaintext,
      randomBytes: (length: number) => new Uint8Array(length),
    },
  };
});

import { VaultBlobType, type VaultApi } from '@myorganizer/app-api-client';
import {
  putVaultRecord,
  renameGroceryList,
  setListLineAmount,
  setListLineChecked,
  type VaultBlobEnvelope,
} from '@myorganizer/vault-core/portable';

import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from './bytes';
import {
  createVaultBlobController,
  type VaultBlobState,
} from './vaultBlobController';

type Envelope = VaultBlobEnvelope<unknown>;
/** A decrypted payload with envelope keys this build does not know. */
type Payload = Envelope & Record<string, unknown>;
type Rec = Record<string, unknown> & { id: string };

const NETWORK_ERROR = { message: 'Network Error', code: 'ERR_NETWORK' };
const STAMP = '2026-02-01T00:00:00.000Z';
const LATER = '2026-03-01T00:00:00.000Z';

/**
 * A server holding one Vault Blob. `enforceIfMatch` refuses a write made under
 * a stale ETag with a 409. `beforeNextWrite` runs once before the next PUT is
 * judged, so a test can have another device write in between.
 * `anotherDeviceWrites` replaces the held copy and moves the ETag on.
 */
function fakeServer(initial: Payload) {
  let held: Payload = initial;
  let version = 1;
  const server = {
    failWrites: false,
    enforceIfMatch: false,
    beforeNextWrite: null as (() => void) | null,
    bodies: [] as Payload[],
    envelope: (): Payload => held,
    anotherDeviceWrites: (next: Payload): void => {
      held = next;
      version += 1;
    },
    lastBody: (): Payload => {
      const body = server.bodies[server.bodies.length - 1];
      if (body === undefined) throw new Error('no body received');
      return body;
    },
    api: {
      getVaultBlob: jest.fn(async () => ({
        data: {
          blob: {
            iv: bytesToBase64(new Uint8Array(12)),
            ciphertext: bytesToBase64(utf8ToBytes(JSON.stringify(held))),
          },
          etag: `"v${version}"`,
        },
      })),
      putVaultBlob: jest.fn(
        async (request: {
          putVaultBlobRequest: { blob: { ciphertext: string } };
          ifMatch?: string;
        }) => {
          const hook = server.beforeNextWrite;
          server.beforeNextWrite = null;
          hook?.();
          if (server.failWrites) throw NETWORK_ERROR;
          if (server.enforceIfMatch && request.ifMatch !== `"v${version}"`) {
            throw { response: { status: 409 } };
          }
          held = JSON.parse(
            bytesToUtf8(
              base64ToBytes(request.putVaultBlobRequest.blob.ciphertext),
            ),
          );
          server.bodies.push(held);
          version += 1;
          return { data: { etag: `"v${version}"` } };
        },
      ),
    },
  };
  return server;
}

function setup(initial: Payload, type: VaultBlobType = VaultBlobType.Tasks) {
  const server = fakeServer(initial);
  let latest: VaultBlobState | null = null;
  const controller = createVaultBlobController({
    getSession: () => ({
      vaultApi: server.api as unknown as VaultApi,
      masterKey: new Uint8Array(32),
      type,
    }),
    onState: (next) => {
      latest = next;
    },
  });
  return {
    server,
    controller,
    state: (): VaultBlobState => {
      if (latest === null) throw new Error('no state reported yet');
      return latest;
    },
  };
}

/** The record carrying `id` in an array-shaped envelope, as the edit reads it. */
function storedRecord(envelope: Envelope, id: string): Rec {
  const found = (envelope.records as unknown[]).find(
    (entry) => (entry as { id?: unknown }).id === id,
  );
  if (found === undefined) throw new Error(`no record ${id}`);
  return found as Rec;
}

/**
 * A record edit built the way the screens build one: the stored record, with
 * the changes laid over it, written through `putVaultRecord`.
 */
const editRecord =
  (id: string, changes: Record<string, unknown>, updatedAt = LATER) =>
  (envelope: Envelope): Envelope =>
    putVaultRecord(envelope, {
      ...storedRecord(envelope, id),
      ...changes,
      updatedAt,
    });

const taskOf = (id: string, updatedAt = STAMP) => ({
  id,
  title: `Task ${id}`,
  createdAt: STAMP,
  updatedAt,
});

const usageLocation = (): Record<string, unknown> => ({
  id: 'u1',
  organisationName: 'Bank',
  organisationType: 'bank',
  updateMethod: 'online',
  changed: false,
  priority: 'normal',
  createdAt: STAMP,
  locationNote: 'kept usage location',
});

/** The four array-shaped Vault Blob Types, each with its own known field. */
const RECORD_TYPE_ROWS: ReadonlyArray<{
  type: VaultBlobType;
  field: string;
  build: (id: string) => Record<string, unknown>;
}> = [
  { type: VaultBlobType.Tasks, field: 'title', build: taskOf },
  {
    type: VaultBlobType.Subscriptions,
    field: 'name',
    build: (id) => ({
      id,
      name: `Subscription ${id}`,
      startDate: STAMP,
      status: 'active',
      updatedAt: STAMP,
    }),
  },
  {
    type: VaultBlobType.Addresses,
    field: 'label',
    build: (id) => ({
      id,
      label: `Home ${id}`,
      status: 'current',
      usageLocations: [usageLocation()],
      createdAt: STAMP,
      updatedAt: STAMP,
    }),
  },
  {
    type: VaultBlobType.MobileNumbers,
    field: 'label',
    build: (id) => ({
      id,
      label: `Mobile ${id}`,
      usageLocations: [usageLocation()],
      createdAt: STAMP,
      updatedAt: STAMP,
    }),
  },
];

describe('mobile push keeps unknown fields per Vault Blob Type', () => {
  it.each(RECORD_TYPE_ROWS)(
    'keeps every unknown field on $type across an edit of one record, then of the other',
    async ({ type, field, build }) => {
      const { server, controller } = setup(
        {
          records: [
            { ...build('a'), noteA: 'kept a' },
            { ...build('b'), noteB: 'kept b' },
          ],
          deletions: {},
          envelopeNote: 'kept envelope',
        },
        type,
      );
      await controller.reload();

      await expect(
        controller.apply(editRecord('a', { [field]: 'edited a' })),
      ).resolves.toBe(true);

      const editedA = {
        ...build('a'),
        noteA: 'kept a',
        [field]: 'edited a',
        updatedAt: LATER,
      };
      const untouchedB = { ...build('b'), noteB: 'kept b' };
      expect(server.lastBody()).toEqual({
        records: [editedA, untouchedB],
        deletions: {},
        envelopeNote: 'kept envelope',
      });

      await expect(
        controller.apply(editRecord('b', { [field]: 'edited b' })),
      ).resolves.toBe(true);

      expect(server.lastBody()).toEqual({
        records: [
          editedA,
          {
            ...build('b'),
            noteB: 'kept b',
            [field]: 'edited b',
            updatedAt: LATER,
          },
        ],
        deletions: {},
        envelopeNote: 'kept envelope',
      });
    },
  );
});

describe('mobile push of Groceries keeps unknown fields through a trip edit', () => {
  const groceries = (): Payload => ({
    records: {
      catalog: [
        {
          id: 'c1',
          name: 'Milk',
          category: 'dairy',
          createdAt: STAMP,
          updatedAt: STAMP,
          noteCatalog: 'kept catalog item',
        },
      ],
      lists: [
        {
          id: 'l1',
          name: 'Weekly',
          createdAt: STAMP,
          updatedAt: STAMP,
          noteList: 'kept list',
          lines: [
            {
              id: 'ln1',
              catalogItemId: 'c1',
              checked: false,
              createdAt: STAMP,
              updatedAt: STAMP,
              noteLine: 'kept line',
            },
          ],
        },
      ],
      notePayload: 'kept payload',
    },
    deletions: {},
    envelopeNote: 'kept envelope',
  });

  const TRIP_EDITS: ReadonlyArray<{
    name: string;
    edit: (envelope: Envelope) => Envelope;
    expectedLine: Record<string, unknown>;
  }> = [
    {
      name: 'checks a line',
      edit: (envelope) =>
        setListLineChecked(envelope, 'l1', 'ln1', true, LATER),
      expectedLine: { checked: true },
    },
    {
      name: 'sets a line amount',
      edit: (envelope) => setListLineAmount(envelope, 'l1', 'ln1', '2', LATER),
      expectedLine: { amount: '2' },
    },
  ];

  it.each(TRIP_EDITS)(
    'keeps the Catalog Item, the list, the line and the payload when a trip edit $name',
    async ({ edit, expectedLine }) => {
      const initial = groceries();
      const { server, controller } = setup(initial, VaultBlobType.Groceries);
      await controller.reload();

      await expect(controller.apply(edit)).resolves.toBe(true);

      const body = server.lastBody();
      const payload = body.records as Record<string, unknown>;
      const initialPayload = initial.records as Record<string, unknown>;
      expect(payload['notePayload']).toBe('kept payload');
      expect(body.envelopeNote).toBe('kept envelope');
      expect(payload['catalog']).toEqual(initialPayload['catalog']);
      const lists = payload['lists'] as Array<Record<string, unknown>>;
      expect(lists[0]).toMatchObject({ id: 'l1', noteList: 'kept list' });
      const lines = lists[0]?.['lines'] as Array<Record<string, unknown>>;
      expect(lines[0]).toMatchObject({
        id: 'ln1',
        noteLine: 'kept line',
        ...expectedLine,
      });
    },
  );

  it('keeps every unknown field on the records a trip edit does not touch, when two edits target different lists and lines', async () => {
    const twoLists = (): Payload => ({
      records: {
        catalog: [
          {
            id: 'c1',
            name: 'Milk',
            category: 'dairy',
            createdAt: STAMP,
            updatedAt: STAMP,
            noteCatalog1: 'kept catalog item 1',
          },
          {
            id: 'c2',
            name: 'Bread',
            category: 'bakery',
            createdAt: STAMP,
            updatedAt: STAMP,
            noteCatalog2: 'kept catalog item 2',
          },
        ],
        lists: [
          {
            id: 'l1',
            name: 'Weekly',
            createdAt: STAMP,
            updatedAt: STAMP,
            noteList1: 'kept list 1',
            lines: [
              {
                id: 'ln1',
                catalogItemId: 'c1',
                checked: false,
                createdAt: STAMP,
                updatedAt: STAMP,
                noteLine1: 'kept line 1',
              },
              {
                id: 'ln2',
                catalogItemId: 'c2',
                checked: false,
                createdAt: STAMP,
                updatedAt: STAMP,
                noteLine2: 'kept line 2',
              },
            ],
          },
          {
            id: 'l2',
            name: 'Monthly',
            createdAt: STAMP,
            updatedAt: STAMP,
            noteList2: 'kept list 2',
            lines: [],
          },
        ],
        notePayload: 'kept payload',
      },
      deletions: {},
      envelopeNote: 'kept envelope',
    });
    const initial = twoLists();
    const { server, controller } = setup(initial, VaultBlobType.Groceries);
    await controller.reload();

    await expect(
      controller.apply((envelope) =>
        setListLineChecked(envelope, 'l1', 'ln2', true, LATER),
      ),
    ).resolves.toBe(true);
    await expect(
      controller.apply((envelope) =>
        renameGroceryList(envelope, 'l2', 'Monthly renamed', LATER),
      ),
    ).resolves.toBe(true);

    const body = server.lastBody();
    const payload = body.records as Record<string, unknown>;
    const initialPayload = initial.records as Record<string, unknown>;
    const initialLists = initialPayload['lists'] as Array<
      Record<string, unknown>
    >;
    const initialLines = initialLists[0]?.['lines'] as Array<
      Record<string, unknown>
    >;
    expect(body.envelopeNote).toBe('kept envelope');
    expect(payload['notePayload']).toBe('kept payload');
    expect(payload['catalog']).toEqual(initialPayload['catalog']);
    expect(payload['lists']).toEqual([
      {
        ...initialLists[0],
        updatedAt: LATER,
        lines: [
          initialLines[0],
          { ...initialLines[1], checked: true, updatedAt: LATER },
        ],
      },
      {
        ...initialLists[1],
        name: 'Monthly renamed',
        updatedAt: LATER,
      },
    ]);
  });
});

describe('mobile push keeps unknown fields through the conflict and retry paths', () => {
  it('keeps the unknown fields of both copies when the first PUT is refused and the push converges', async () => {
    const { server, controller } = setup({
      records: [
        { ...taskOf('a'), noteA: 'kept a' },
        { ...taskOf('b'), noteB: 'kept b' },
      ],
      deletions: {},
      localKey: 'kept local envelope',
    });
    server.enforceIfMatch = true;
    await controller.reload();
    server.beforeNextWrite = () =>
      server.anotherDeviceWrites({
        records: [
          { ...taskOf('a'), noteA: 'kept a' },
          {
            ...taskOf('b', '2026-02-10T00:00:00.000Z'),
            title: 'Task b from another device',
            noteB: 'kept b',
            otherNote: 'kept by another device',
          },
        ],
        deletions: {},
        remoteKey: 'kept remote envelope',
      });

    await expect(
      controller.apply(editRecord('a', { title: 'Task a edited' })),
    ).resolves.toBe(true);

    expect(server.api.putVaultBlob).toHaveBeenCalledTimes(2);
    expect(server.api.putVaultBlob).toHaveBeenLastCalledWith(
      expect.objectContaining({ ifMatch: '"v2"' }),
    );
    expect(server.lastBody()).toEqual({
      records: [
        {
          ...taskOf('a'),
          noteA: 'kept a',
          title: 'Task a edited',
          updatedAt: LATER,
        },
        {
          ...taskOf('b', '2026-02-10T00:00:00.000Z'),
          title: 'Task b from another device',
          noteB: 'kept b',
          otherNote: 'kept by another device',
        },
      ],
      deletions: {},
      localKey: 'kept local envelope',
      remoteKey: 'kept remote envelope',
    });
  });

  it('re-runs a held edit on the newer copy when retry follows a failed reload, so a field another device added survives', async () => {
    const { server, controller, state } = setup({
      records: [taskOf('a'), taskOf('b')],
      deletions: {},
      envelopeNote: 'kept envelope',
    });
    await controller.reload();
    server.failWrites = true;
    await expect(
      controller.apply(editRecord('a', { title: 'Task a edited' })),
    ).resolves.toBe(false);
    server.anotherDeviceWrites({
      records: [
        {
          ...taskOf('a', '2026-02-15T00:00:00.000Z'),
          serverNote: 'kept by another device',
        },
        taskOf('b'),
      ],
      deletions: {},
      envelopeNote: 'kept envelope',
    });
    // The push still fails, so the reload shows the newer copy and holds the edit.
    await expect(controller.reload()).resolves.toBe('held');
    expect(state().snapshot?.envelope.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'a',
          serverNote: 'kept by another device',
        }),
      ]),
    );

    server.failWrites = false;
    await expect(controller.retry()).resolves.toBe(true);

    expect(server.lastBody()).toEqual({
      records: [
        {
          ...taskOf('a', '2026-02-15T00:00:00.000Z'),
          serverNote: 'kept by another device',
          title: 'Task a edited',
          updatedAt: LATER,
        },
        taskOf('b'),
      ],
      deletions: {},
      envelopeNote: 'kept envelope',
    });
  });
});
