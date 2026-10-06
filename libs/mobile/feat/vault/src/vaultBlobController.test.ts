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
 * holds the next read open until the test releases it.
 */
function fakeServer(initial: Envelope) {
  let held = initial;
  let version = 1;
  let release: (() => void) | null = null;
  const server = {
    failReads: false,
    failWrites: false,
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
        }) => {
          if (server.failWrites) throw NETWORK_ERROR;
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
