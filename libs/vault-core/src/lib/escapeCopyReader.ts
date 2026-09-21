/**
 * Opening an Escape Copy — the whole of what the standalone reader does.
 *
 * [ADR 0064](../../../../docs/adr/0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md)
 * requires an Escape Copy to be readable by a tool needing no MyOrganizer
 * server, no MyOrganizer session, and no Google account. This module is that
 * tool's entire brain: envelope text plus a passphrase or a Recovery Key in,
 * plaintext out. It reaches the network never, storage never, and the DOM
 * never — the reader page around it supplies the file and renders the result,
 * and that page is deliberately the only part of the reader that is not this.
 *
 * It lives beside the exporter's own schema and the exporter's own crypto
 * rather than inside the reader artifact, because a reader with its own copy
 * of either is a second implementation of the thing that must never disagree
 * with the first — and it would disagree silently, discovered at the one
 * moment anybody runs it. `yarn escape-copy-reader:check` builds the reader
 * from this module and opens a freshly produced envelope with it, which is
 * ADR 0064's second decision.
 *
 * The local-file Export and the Drive backup produce the identical envelope,
 * so nothing here knows which one it was handed. That is the point.
 */
import {
  aesGcmDecrypt,
  base64ToBytes,
  bytesToUtf8,
  deriveKeyFromPassphrase,
  importAesGcmKey,
} from './vaultCrypto';
import {
  VAULT_EXPORT_BLOB_TYPES,
  type VaultExportBlobType,
  type VaultExportEnvelope,
  CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
  parseVaultExportEnvelope,
} from './vaultExportEnvelope';
import { VaultImportError } from './vaultImportError';

/**
 * The two secrets an Escape Copy can be opened with, which are the two
 * wrappings `localToServerMeta` puts in every envelope. A reader offering only
 * one of them would be unopenable for exactly the User who lost the other,
 * which is the User most likely to be holding an Escape Copy at all.
 */
export type EscapeCopySecret =
  | { readonly kind: 'passphrase'; readonly value: string }
  | { readonly kind: 'recovery-key'; readonly value: string };

/**
 * Thrown when the supplied secret does not unwrap the Master Key.
 *
 * Kept distinct from a `decrypt-failed` {@link VaultImportError} on purpose:
 * a Master Key that will not unwrap is a statement about the secret the User
 * typed, and a Vault Blob that will not decrypt under a Master Key that did
 * unwrap is a statement about the file. Told apart here, the reader can say
 * "that passphrase is wrong" instead of "this copy is damaged" — advice that
 * is the opposite of helpful when it is the wrong one.
 */
export class EscapeCopySecretMismatchError extends Error {
  public readonly secret: EscapeCopySecret['kind'];

  constructor(secret: EscapeCopySecret['kind']) {
    super(
      secret === 'passphrase'
        ? 'That passphrase does not open this Escape Copy.'
        : 'That Recovery Key does not open this Escape Copy.',
    );
    this.name = 'EscapeCopySecretMismatchError';
    this.secret = secret;
    Object.setPrototypeOf(this, EscapeCopySecretMismatchError.prototype);
  }
}

export function isEscapeCopySecretMismatchError(
  value: unknown,
): value is EscapeCopySecretMismatchError {
  return value instanceof EscapeCopySecretMismatchError;
}

/** One Vault Blob Type's plaintext, or the reason there is none. */
export interface OpenedEscapeCopySection {
  readonly type: VaultExportBlobType;
  /** Whether the envelope carried this Vault Blob Type at all. */
  readonly present: boolean;
  /** The decrypted JSON payload. `null` whenever `present` is false. */
  readonly plaintext: unknown;
}

/** Everything a reader can show about one opened Escape Copy. */
export interface OpenedEscapeCopy {
  readonly schemaVersion: number;
  readonly exportId: string;
  readonly exportedAt: string;
  /**
   * One section per Vault Blob Type, in the pinned order — including the ones
   * this envelope does not carry. A reader that listed only the present ones
   * could not tell "your Vault had no Subscriptions" from "this reader does
   * not know about Subscriptions", and the second is the failure ADR 0064's
   * gate exists to catch.
   */
  readonly sections: readonly OpenedEscapeCopySection[];
}

/**
 * The KDF iteration count this envelope's meta declares.
 *
 * Read off the envelope rather than pinned to a constant, deliberately. The
 * reader's job is to open a copy produced by whatever the exporter was doing
 * at the time, and the iteration count is the one KDF parameter that has
 * moved before and will move again; a reader carrying today's number would
 * fail to open yesterday's file for no reason other than remembering wrong
 * ([ADR 0051](../../../../docs/adr/0051-a-pinned-value-does-not-notice-that-its-meaning-moved.md)).
 */
function iterationsOf(envelope: VaultExportEnvelope): number {
  const declared = envelope.meta.kdf_params?.['iterations'];
  if (
    typeof declared !== 'number' ||
    !Number.isInteger(declared) ||
    declared < 1
  ) {
    throw new VaultImportError(
      'corrupt-file',
      'Envelope meta declares no usable KDF iteration count',
    );
  }
  return declared;
}

function assertSupportedKdf(envelope: VaultExportEnvelope): void {
  const { kdf_name: name, kdf_params: params } = envelope.meta;
  if (name !== 'PBKDF2') {
    throw new VaultImportError(
      'schema-version-unsupported',
      `This reader opens PBKDF2 Escape Copies; this one declares ${name}.`,
    );
  }
  const hash = params?.['hash'];
  if (hash !== undefined && hash !== 'SHA-256') {
    throw new VaultImportError(
      'schema-version-unsupported',
      `This reader opens SHA-256 Escape Copies; this one declares ${String(hash)}.`,
    );
  }
}

/**
 * Unwrap the Master Key with whichever secret the User supplied.
 *
 * Both arms end in the same AES-GCM unwrap of a wrapping the envelope already
 * carries; they differ only in where the wrapping key comes from — derived
 * from the passphrase, or the Recovery Key's own raw bytes, which wrap the
 * Master Key directly rather than deriving anything.
 */
async function unwrapMasterKey(options: {
  envelope: VaultExportEnvelope;
  secret: EscapeCopySecret;
}): Promise<CryptoKey> {
  const { envelope, secret } = options;

  let wrappingKey: CryptoKey;
  let wrapped: { iv: string; ciphertext: string };

  if (secret.kind === 'passphrase') {
    wrappingKey = await deriveKeyFromPassphrase({
      passphrase: secret.value,
      salt: base64ToBytes(envelope.meta.kdf_salt),
      iterations: iterationsOf(envelope),
    });
    wrapped = envelope.meta.wrapped_mk_passphrase;
  } else {
    try {
      wrappingKey = await importAesGcmKey(base64ToBytes(secret.value.trim()));
    } catch {
      // A Recovery Key that is not importable at all is still a wrong secret
      // rather than a damaged copy: the User mistyped it or pasted the wrong
      // thing, and nothing about the file is in question.
      throw new EscapeCopySecretMismatchError('recovery-key');
    }
    wrapped = envelope.meta.wrapped_mk_recovery;
  }

  let masterKeyBytes: Uint8Array;
  try {
    masterKeyBytes = await aesGcmDecrypt({
      key: wrappingKey,
      iv: base64ToBytes(wrapped.iv),
      ciphertext: base64ToBytes(wrapped.ciphertext),
    });
  } catch {
    throw new EscapeCopySecretMismatchError(secret.kind);
  }

  return importAesGcmKey(masterKeyBytes);
}

async function decryptSection(options: {
  masterKey: CryptoKey;
  type: VaultExportBlobType;
  blob: { iv: string; ciphertext: string } | undefined;
}): Promise<OpenedEscapeCopySection> {
  const { masterKey, type, blob } = options;
  if (!blob) return { type, present: false, plaintext: null };

  let plaintextBytes: Uint8Array;
  try {
    plaintextBytes = await aesGcmDecrypt({
      key: masterKey,
      iv: base64ToBytes(blob.iv),
      ciphertext: base64ToBytes(blob.ciphertext),
    });
  } catch (error) {
    // The Master Key already unwrapped, so the secret is right and this blob
    // is not. Reported as the file's problem, which is what it is.
    throw new VaultImportError(
      'decrypt-failed',
      `The ${type} section of this Escape Copy could not be decrypted.`,
      error,
    );
  }

  try {
    return {
      type,
      present: true,
      plaintext: JSON.parse(bytesToUtf8(plaintextBytes)),
    };
  } catch (error) {
    throw new VaultImportError(
      'corrupt-file',
      `The ${type} section decrypted but is not valid JSON.`,
      error,
    );
  }
}

/**
 * Open an Escape Copy: parse, unwrap, decrypt every Vault Blob Type it
 * carries, and yield the plaintext.
 *
 * The fan-out reaches `VAULT_EXPORT_BLOB_TYPES` — the envelope schema's own
 * pinned list — rather than enumerating the members here, so a sixth Vault
 * Blob Type cannot be exported and then silently skipped by the one tool
 * whose job is to leave nothing behind
 * ([ADR 0053](../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 * That is the same omission that dropped Tasks from the hardened export path
 * in [#537](https://github.com/mnaimfaizy/myorganizer/issues/537).
 *
 * Nothing is written and nothing is sent. Opening an Escape Copy twice is
 * exactly as safe as opening it once.
 */
export async function openEscapeCopy(options: {
  text: string;
  secret: EscapeCopySecret;
}): Promise<OpenedEscapeCopy> {
  const envelope = parseVaultExportEnvelope(options.text);

  if (envelope.schemaVersion > CURRENT_VAULT_EXPORT_SCHEMA_VERSION) {
    throw new VaultImportError(
      'schema-version-downgrade',
      `This Escape Copy is schema version ${envelope.schemaVersion}; this reader ` +
        `understands up to ${CURRENT_VAULT_EXPORT_SCHEMA_VERSION}. Get a newer reader.`,
    );
  }

  assertSupportedKdf(envelope);

  const masterKey = await unwrapMasterKey({ envelope, secret: options.secret });

  const sections: OpenedEscapeCopySection[] = [];
  for (const type of VAULT_EXPORT_BLOB_TYPES) {
    sections.push(
      await decryptSection({ masterKey, type, blob: envelope.blobs[type] }),
    );
  }

  return {
    schemaVersion: envelope.schemaVersion,
    exportId: envelope.exportId,
    exportedAt: envelope.exportedAt,
    sections,
  };
}
