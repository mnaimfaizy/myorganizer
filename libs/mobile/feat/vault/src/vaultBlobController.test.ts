import { VaultBlobType, type VaultApi } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/vault-core/portable';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from './bytes';
import {
  createVaultBlobController,
  type VaultBlobController,
  type VaultBlobState,
} from './vaultBlobController';
import { createVaultBlobPeers } from './vaultBlobPeers';

// The real module reaches react-native-quick-crypto. Encryption here is the
// identity, so a stored "ciphertext" is the envelope's own JSON.
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

type Envelope = VaultBlobEnvelope<unknown>;

const NETWORK_ERROR = { message: 'Network Error', code: 'ERR_NETWORK' };

/**
 * A server holding one Vault Blob, with switches for the two calls. `gate`
 * holds the next read open until the test releases it. `enforceIfMatch`
 * answers a write made under an ETag the server has moved past with a 409,
 * as the real one does.
 */
function fakeServer(initial: Envelope) {
  let held = initial;
  let version = 1;
  let release: (() => void) | null = null;
  const server = {
    failReads: false,
    failWrites: false,
    enforceIfMatch: false,
    gateNextRead: false,
    releaseRead: (): void => release?.(),
    envelope: (): Envelope => held,
    api: {
      getVaultBlob: jest.fn(async () => {
        if (server.gateNextRead) {
          server.gateNextRead = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        if (server.failReads) throw NETWORK_ERROR;
        return {
          data: {
            blob: {
              iv: bytesToBase64(new Uint8Array(12)),
              ciphertext: bytesToBase64(utf8ToBytes(JSON.stringify(held))),
            },
            etag: `"v${version}"`,
          },
        };
      }),
      putVaultBlob: jest.fn(
        async (request: {
          putVaultBlobRequest: { blob: { ciphertext: string } };
          ifMatch?: string;
        }) => {
          if (server.failWrites) throw NETWORK_ERROR;
          if (server.enforceIfMatch && request.ifMatch !== `"v${version}"`) {
            throw { response: { status: 409 } };
          }
          held = JSON.parse(
            bytesToUtf8(
              base64ToBytes(request.putVaultBlobRequest.blob.ciphertext),
            ),
          );
          version += 1;
          return { data: { etag: `"v${version}"` } };
        },
      ),
    },
  };
  return server;
}

const task = (id: string, updatedAt: string) => ({
  id,
  title: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
});

const addTask =
  (record: ReturnType<typeof task>) =>
  (envelope: Envelope): Envelope => ({
    ...envelope,
    records: [...(envelope.records as unknown[]), record],
  });

function setup(initial: Envelope = { records: [], deletions: {} }): {
  server: ReturnType<typeof fakeServer>;
  controller: VaultBlobController;
  state: () => VaultBlobState;
} {
  const server = fakeServer(initial);
  let latest: VaultBlobState | null = null;
  const controller = createVaultBlobController({
    getSession: () => ({
      vaultApi: server.api as unknown as VaultApi,
      masterKey: new Uint8Array(32),
      type: VaultBlobType.Tasks,
    }),
    onState: (next) => {
      latest = next;
    },
  });
  return {
    server,
    controller,
    state: () => {
      if (latest === null) throw new Error('no state reported yet');
      return latest;
    },
  };
}

describe('createVaultBlobController', () => {
  const first = task('t1', '2026-02-01T00:00:00.000Z');

  it('shows the server copy after the first reload and stops loading', async () => {
    const { controller, state } = setup({ records: [first], deletions: {} });

    await expect(controller.reload()).resolves.toBe('pulled');

    expect(state()).toMatchObject({
      snapshot: { envelope: { records: [first] }, etag: '"v1"' },
      loading: false,
      refreshing: false,
      loadError: null,
      writeError: null,
    });
  });

  it('reverts to the confirmed copy and says why when a push fails', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    server.failWrites = true;

    await expect(controller.apply(addTask(first))).resolves.toBe(false);

    expect(state()).toMatchObject({
      snapshot: { envelope: { records: [] }, etag: '"v1"' },
      writing: false,
      writeError: 'network',
    });
  });

  it('does not push an edit that returns the envelope it was given', async () => {
    const { server, controller, state } = setup({
      records: [first],
      deletions: {},
    });
    await controller.reload();

    await expect(controller.apply((envelope) => envelope)).resolves.toBe(false);

    expect(server.api.putVaultBlob).not.toHaveBeenCalled();
    expect(state()).toMatchObject({
      snapshot: { envelope: { records: [first] }, etag: '"v1"' },
      writing: false,
      writeError: 'not-applied',
    });
  });

  it('holds nothing for an edit that was not applied', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    await controller.apply((envelope) => envelope);

    await expect(controller.retry()).resolves.toBe(false);
    await expect(controller.reload()).resolves.toBe('pulled');

    expect(server.api.putVaultBlob).not.toHaveBeenCalled();
    expect(state().writeError).toBeNull();
  });

  it('drops the edit a failed push left held once a later edit is not applied', async () => {
    const { server, controller } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));
    server.failWrites = false;

    await controller.apply((envelope) => envelope);

    await expect(controller.reload()).resolves.toBe('pulled');
    expect(server.envelope().records).toEqual([]);
  });

  it('resends a failed edit on retry', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));
    server.failWrites = false;

    await expect(controller.retry()).resolves.toBe(true);

    expect(server.envelope().records).toEqual([first]);
    expect(state().writeError).toBeNull();
  });

  it('sends a failed edit on reload, merged with what another device added', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));
    server.failWrites = false;
    const arrived = task('t2', '2026-02-02T00:00:00.000Z');
    await server.api.putVaultBlob({
      putVaultBlobRequest: {
        blob: {
          ciphertext: bytesToBase64(
            utf8ToBytes(JSON.stringify({ records: [arrived], deletions: {} })),
          ),
        },
      },
    });

    await expect(controller.reload()).resolves.toBe('sent');

    expect(server.envelope().records).toEqual([first, arrived]);
    expect(state()).toMatchObject({
      snapshot: { envelope: { records: [first, arrived] } },
      writing: false,
      refreshing: false,
      writeError: null,
    });
    await expect(controller.retry()).resolves.toBe(false);
  });

  it('merges the edit as it was first made rather than running it again', async () => {
    const { server, controller } = setup();
    await controller.reload();
    server.failWrites = true;
    const edit = jest.fn(addTask(first));
    await controller.apply(edit);
    server.failWrites = false;

    await controller.reload();

    expect(edit).toHaveBeenCalledTimes(1);
  });

  it('keeps holding the edit, on the server copy, when the reload cannot send it', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));

    await expect(controller.reload()).resolves.toBe('held');

    expect(state()).toMatchObject({
      snapshot: { envelope: { records: [] }, etag: '"v1"' },
      writing: false,
      writeError: 'network',
    });
    server.failWrites = false;
    await expect(controller.reload()).resolves.toBe('sent');
    expect(server.envelope().records).toEqual([first]);
  });

  it('keeps the edit and its error when the reload cannot read', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));
    server.failReads = true;

    await expect(controller.reload()).resolves.toBe('held');

    expect(state()).toMatchObject({
      loadError: NETWORK_ERROR,
      writeError: 'network',
      refreshing: false,
    });
    server.failReads = false;
    server.failWrites = false;
    await expect(controller.reload()).resolves.toBe('sent');
  });

  it('sends nothing on reload once the edit is discarded', async () => {
    const { server, controller, state } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));
    server.failWrites = false;

    controller.discard();

    expect(state().writeError).toBeNull();
    await expect(controller.reload()).resolves.toBe('pulled');
    expect(server.envelope().records).toEqual([]);
    await expect(controller.retry()).resolves.toBe(false);
  });

  it('does not discard an edit a reload is already sending', async () => {
    const { server, controller } = setup();
    await controller.reload();
    server.failWrites = true;
    await controller.apply(addTask(first));
    server.failWrites = false;
    server.gateNextRead = true;

    const reloading = controller.reload();
    controller.discard();
    server.releaseRead();

    await expect(reloading).resolves.toBe('sent');
    expect(server.envelope().records).toEqual([first]);
  });

  it('runs one request at a time', async () => {
    const { server, controller } = setup();
    await controller.reload();
    server.gateNextRead = true;

    const reloading = controller.reload();
    await expect(controller.reload()).resolves.toBe('pulled');
    await expect(controller.apply(addTask(first))).resolves.toBe(false);
    server.releaseRead();
    await reloading;

    expect(server.api.getVaultBlob).toHaveBeenCalledTimes(2);
    expect(server.api.putVaultBlob).not.toHaveBeenCalled();
  });

  it('does nothing without a Master Key', async () => {
    const server = fakeServer({ records: [], deletions: {} });
    const controller = createVaultBlobController({
      getSession: () => ({
        vaultApi: server.api as unknown as VaultApi,
        masterKey: null,
        type: VaultBlobType.Tasks,
      }),
      onState: jest.fn(),
    });

    await expect(controller.reload()).resolves.toBe('pulled');
    expect(server.api.getVaultBlob).not.toHaveBeenCalled();
  });
});

/**
 * Two screens on one server: a list and the detail pushed over it, each with
 * its own controller, told of each other's confirmed writes through `peers`.
 * Each side's session is a plain object the test may change under it.
 */
function setupPair(initial: Envelope = { records: [], deletions: {} }) {
  const server = fakeServer(initial);
  const peers = createVaultBlobPeers();
  const masterKey = new Uint8Array(32);
  const side = () => {
    const session: {
      vaultApi: VaultApi;
      masterKey: Uint8Array | null;
      type: VaultBlobType;
    } = {
      vaultApi: server.api as unknown as VaultApi,
      masterKey,
      type: VaultBlobType.Tasks,
    };
    let latest: VaultBlobState | null = null;
    const controller = createVaultBlobController({
      getSession: () => session,
      onState: (next) => {
        latest = next;
      },
      peers,
    });
    return {
      session,
      controller,
      leave: controller.join(),
      state: (): VaultBlobState => {
        if (latest === null) throw new Error('no state reported yet');
        return latest;
      },
    };
  };
  return { server, list: side(), detail: side() };
}

describe('createVaultBlobController, told of a peer’s confirmed write', () => {
  const first = task('t1', '2026-02-01T00:00:00.000Z');
  const second = task('t2', '2026-02-02T00:00:00.000Z');

  it('shows a write its peer had confirmed, at that write’s ETag, with no request of its own', async () => {
    const { server, list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    server.api.getVaultBlob.mockClear();

    await expect(detail.controller.apply(addTask(first))).resolves.toBe(true);

    expect(list.state()).toMatchObject({
      snapshot: { envelope: { records: [first] }, etag: '"v2"' },
      writing: false,
      writeError: null,
    });
    expect(server.api.getVaultBlob).not.toHaveBeenCalled();
  });

  it('pushes its next edit under the ETag it was told, so the server does not refuse it', async () => {
    const { server, list, detail } = setupPair();
    server.enforceIfMatch = true;
    await list.controller.reload();
    await detail.controller.reload();
    await detail.controller.apply(addTask(first));
    server.api.getVaultBlob.mockClear();

    await expect(list.controller.apply(addTask(second))).resolves.toBe(true);

    expect(server.envelope().records).toEqual([first, second]);
    expect(server.api.putVaultBlob).toHaveBeenCalledTimes(2);
    expect(server.api.getVaultBlob).not.toHaveBeenCalled();
  });

  it('keeps its own writing state and write error out of its peer', async () => {
    const { server, list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    server.failWrites = true;

    await detail.controller.apply(addTask(first));

    expect(detail.state().writeError).toBe('network');
    expect(list.state()).toMatchObject({
      snapshot: { envelope: { records: [] }, etag: '"v1"' },
      writing: false,
      writeError: null,
    });
  });

  it('does not take a write while a request of its own is in flight', async () => {
    const { server, list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    server.gateNextRead = true;
    const reloading = list.controller.reload();

    await detail.controller.apply(addTask(first));

    expect(list.state()).toMatchObject({
      snapshot: { envelope: { records: [] }, etag: '"v1"' },
      refreshing: true,
    });
    server.releaseRead();
    await reloading;
  });

  it('does not take a write while it holds an edit whose push failed, and converges on its own retry', async () => {
    const { server, list, detail } = setupPair();
    server.enforceIfMatch = true;
    await list.controller.reload();
    await detail.controller.reload();
    server.failWrites = true;
    await list.controller.apply(addTask(first));
    server.failWrites = false;

    await detail.controller.apply(addTask(second));

    expect(list.state()).toMatchObject({
      snapshot: { envelope: { records: [] }, etag: '"v1"' },
      writeError: 'network',
    });

    await expect(list.controller.retry()).resolves.toBe(true);

    expect(server.envelope().records).toEqual(
      expect.arrayContaining([first, second]),
    );
    expect(list.state().snapshot?.envelope.records).toEqual(
      expect.arrayContaining([first, second]),
    );
    // And the edit it held, once sent, is told to the peer in turn.
    expect(detail.state().snapshot?.envelope.records).toEqual(
      expect.arrayContaining([first, second]),
    );
  });

  it('does not take a write to another Vault Blob Type', async () => {
    const { list, detail } = setupPair();
    list.session.type = VaultBlobType.Subscriptions;
    await list.controller.reload();
    await detail.controller.reload();

    await detail.controller.apply(addTask(first));

    expect(list.state().snapshot).toMatchObject({
      envelope: { records: [] },
      etag: '"v1"',
    });
  });

  it('takes nothing once it has left', async () => {
    const { list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    list.leave();

    await detail.controller.apply(addTask(first));

    expect(list.state().snapshot).toMatchObject({
      envelope: { records: [] },
      etag: '"v1"',
    });
  });

  it('still tells its peer of a write that is confirmed after it has left', async () => {
    const { list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    detail.leave();

    await detail.controller.apply(addTask(first));

    expect(list.state().snapshot?.envelope.records).toEqual([first]);
  });

  it('does not take a write made under another Master Key', async () => {
    const { list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    // The same bytes in another object: a later Vault Unlock.
    list.session.masterKey = new Uint8Array(32);

    await detail.controller.apply(addTask(first));

    expect(list.state().snapshot).toMatchObject({
      envelope: { records: [] },
      etag: '"v1"',
    });
  });

  it('does not take a write while it has no Master Key', async () => {
    const { list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    list.session.masterKey = null;

    await detail.controller.apply(addTask(first));

    expect(list.state().snapshot).toMatchObject({
      envelope: { records: [] },
      etag: '"v1"',
    });
  });

  it('does not tell its peer of a copy it only read', async () => {
    const { server, list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    await server.api.putVaultBlob({
      putVaultBlobRequest: {
        blob: {
          ciphertext: bytesToBase64(
            utf8ToBytes(JSON.stringify({ records: [first], deletions: {} })),
          ),
        },
      },
    });

    await expect(detail.controller.reload()).resolves.toBe('pulled');

    expect(detail.state().snapshot?.envelope.records).toEqual([first]);
    expect(list.state().snapshot).toMatchObject({
      envelope: { records: [] },
      etag: '"v1"',
    });
  });

  it('tells its peer of the edit a reload sent', async () => {
    const { server, list, detail } = setupPair();
    await list.controller.reload();
    await detail.controller.reload();
    server.failWrites = true;
    await detail.controller.apply(addTask(first));
    server.failWrites = false;

    await expect(detail.controller.reload()).resolves.toBe('sent');

    expect(list.state().snapshot).toMatchObject({
      envelope: { records: [first] },
      etag: '"v2"',
    });
  });

  it('settles a first read that failed with the write it is told', async () => {
    const { server, list, detail } = setupPair();
    await detail.controller.reload();
    server.failReads = true;
    await list.controller.reload();
    server.failReads = false;
    expect(list.state().loadError).not.toBeNull();

    await detail.controller.apply(addTask(first));

    expect(list.state()).toMatchObject({
      snapshot: { envelope: { records: [first] }, etag: '"v2"' },
      loading: false,
      loadError: null,
    });
  });
});
