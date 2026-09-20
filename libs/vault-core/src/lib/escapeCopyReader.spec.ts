import { describe, expect, it } from '@jest/globals';

import {
  EscapeCopySecretMismatchError,
  isEscapeCopySecretMismatchError,
  openEscapeCopy,
} from './escapeCopyReader';
import {
  CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
  VAULT_EXPORT_BLOB_TYPES,
  type VaultExportBlobType,
} from './vaultExportEnvelope';
import { VaultImportError } from './vaultImportError';
import {
  aesGcmEncrypt,
  bytesToBase64,
  deriveKeyFromPassphrase,
  importAesGcmKey,
  randomBytes,
  utf8ToBytes,
} from './vaultCrypto';

/** A throwaway test passphrase. Nothing outside this file knows it. */
const TEST_PASSPHRASE = ['unit', 'test', 'vault', 'phrase'].join('-');
const ITERATIONS = 310_000;

async function wrap(key: CryptoKey, plaintext: Uint8Array) {
  const iv = randomBytes(12);
  const ciphertext = await aesGcmEncrypt({ key, plaintext, iv });
  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * An envelope in the shape `localToServerMeta` + `exportVault` produce, built
 * here from the same crypto the exporter uses.
 *
 * Deliberately hand-assembled rather than imported from `web-vault`:
 * `vault-core` may not depend on a `scope:web` library, and the assertion that
 * the reader opens what the *real* exporter produced belongs to the gate
 * (`yarn escape-copy-reader:check`), which builds both and runs them against
 * each other. This spec covers the reader's own branches.
 */
async function mintEscapeCopy(
  options: {
    payloads?: Partial<Record<VaultExportBlobType, unknown>>;
    kdfName?: string;
    hash?: string;
    schemaVersion?: number;
  } = {},
) {
  const payloads = options.payloads ?? {
    addresses: { records: [{ id: 'a1', label: 'Home' }] },
    tasks: { records: [{ id: 't1', title: 'Renew passport' }] },
  };

  const salt = randomBytes(16);
  const masterKeyBytes = randomBytes(32);
  const masterKey = await importAesGcmKey(masterKeyBytes);
  const recoveryKeyBytes = randomBytes(32);

  const passphraseKey = await deriveKeyFromPassphrase({
    passphrase: TEST_PASSPHRASE,
    salt,
    iterations: ITERATIONS,
  });
  const recoveryWrappingKey = await importAesGcmKey(recoveryKeyBytes);

  const blobs: Record<string, unknown> = {};
  for (const [type, payload] of Object.entries(payloads)) {
    blobs[type] = await wrap(masterKey, utf8ToBytes(JSON.stringify(payload)));
  }

  const envelope = {
    schemaVersion: options.schemaVersion ?? CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
    exportId: '3f5b4a2c-7d1e-4b6a-9c8d-0e1f2a3b4c5d',
    exportedAt: '2026-09-20T10:00:00.000Z',
    meta: {
      version: 1,
      kdf_name: options.kdfName ?? 'PBKDF2',
      kdf_salt: bytesToBase64(salt),
      kdf_params: { hash: options.hash ?? 'SHA-256', iterations: ITERATIONS },
      wrapped_mk_passphrase: await wrap(passphraseKey, masterKeyBytes),
      wrapped_mk_recovery: await wrap(recoveryWrappingKey, masterKeyBytes),
    },
    blobs,
  };

  return {
    text: JSON.stringify(envelope, null, 2),
    envelope,
    recoveryKey: bytesToBase64(recoveryKeyBytes),
  };
}

describe('openEscapeCopy', () => {
  it('yields plaintext for a copy opened with the passphrase', async () => {
    const copy = await mintEscapeCopy();

    const opened = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    });

    expect(opened.exportId).toBe(copy.envelope.exportId);
    expect(opened.exportedAt).toBe(copy.envelope.exportedAt);
    expect(opened.schemaVersion).toBe(CURRENT_VAULT_EXPORT_SCHEMA_VERSION);
    expect(
      opened.sections.find((section) => section.type === 'addresses')
        ?.plaintext,
    ).toEqual({ records: [{ id: 'a1', label: 'Home' }] });
  });

  it('yields the same plaintext for the same copy opened with the Recovery Key', async () => {
    const copy = await mintEscapeCopy();

    const byPassphrase = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    });
    const byRecoveryKey = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'recovery-key', value: copy.recoveryKey },
    });

    expect(byRecoveryKey.sections).toEqual(byPassphrase.sections);
  });

  it('reports every Vault Blob Type, including the ones the copy does not carry', async () => {
    const copy = await mintEscapeCopy({
      payloads: { groceries: { catalog: [], lists: [] } },
    });

    const opened = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    });

    // The pinned list, not a hand-written one: a sixth Vault Blob Type added
    // to the envelope schema fails here until the reader carries it too.
    expect(opened.sections.map((section) => section.type)).toEqual([
      ...VAULT_EXPORT_BLOB_TYPES,
    ]);
    expect(
      opened.sections.filter((section) => section.present).map((s) => s.type),
    ).toEqual(['groceries']);
    for (const section of opened.sections) {
      if (!section.present) expect(section.plaintext).toBeNull();
    }
  });

  it('refuses a wrong passphrase as a wrong secret, not a damaged copy', async () => {
    const copy = await mintEscapeCopy();

    const error = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'passphrase', value: 'some other phrase' },
    }).catch((e: unknown) => e);

    expect(isEscapeCopySecretMismatchError(error)).toBe(true);
    expect((error as EscapeCopySecretMismatchError).secret).toBe('passphrase');
  });

  it('refuses a Recovery Key that is not even importable as a wrong secret', async () => {
    const copy = await mintEscapeCopy();

    const error = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'recovery-key', value: 'AAAA' },
    }).catch((e: unknown) => e);

    expect(isEscapeCopySecretMismatchError(error)).toBe(true);
    expect((error as EscapeCopySecretMismatchError).secret).toBe(
      'recovery-key',
    );
  });

  it('refuses a copy whose schema version is newer than the reader understands', async () => {
    const copy = await mintEscapeCopy({
      schemaVersion: CURRENT_VAULT_EXPORT_SCHEMA_VERSION + 1,
    });

    const error = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VaultImportError);
    expect((error as VaultImportError).code).toBe('schema-version-downgrade');
  });

  it('refuses a KDF it does not implement rather than deriving the wrong key', async () => {
    const copy = await mintEscapeCopy({ kdfName: 'Argon2id' });

    const error = await openEscapeCopy({
      text: copy.text,
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VaultImportError);
    expect((error as VaultImportError).code).toBe('schema-version-unsupported');
  });

  it('reads the iteration count off the copy rather than a pinned constant', async () => {
    const copy = await mintEscapeCopy();
    const tampered = JSON.parse(copy.text);
    tampered.meta.kdf_params.iterations = ITERATIONS + 1;

    // Deriving with a different iteration count yields a different wrapping
    // key, so the unwrap fails — which is only observable if the reader used
    // the envelope's number at all.
    const error = await openEscapeCopy({
      text: JSON.stringify(tampered),
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    }).catch((e: unknown) => e);

    expect(isEscapeCopySecretMismatchError(error)).toBe(true);
  });

  it('calls a blob that will not decrypt under a working Master Key a damaged copy', async () => {
    const copy = await mintEscapeCopy();
    const tampered = JSON.parse(copy.text);
    const good = tampered.blobs.addresses.ciphertext as string;
    tampered.blobs.addresses.ciphertext =
      (good[0] === 'A' ? 'B' : 'A') + good.slice(1);

    const error = await openEscapeCopy({
      text: JSON.stringify(tampered),
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VaultImportError);
    expect((error as VaultImportError).code).toBe('decrypt-failed');
    expect(isEscapeCopySecretMismatchError(error)).toBe(false);
  });

  it('refuses a file that is not an envelope at all', async () => {
    const error = await openEscapeCopy({
      text: '{"not":"an envelope"}',
      secret: { kind: 'passphrase', value: TEST_PASSPHRASE },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VaultImportError);
    expect((error as VaultImportError).code).toBe('corrupt-file');
  });
});
