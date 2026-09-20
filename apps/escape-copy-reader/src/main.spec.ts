/**
 * The page half of the reader, against the real page shell.
 *
 * The shell is read off disk rather than hand-written here, so an element the
 * glue looks up by id and the shell no longer carries fails as a test rather
 * than as a reader that throws on load in somebody's hands. Everything below
 * the glue — parsing, unwrapping, decrypting — is covered by `vault-core`'s
 * own suite and asserted end to end against the built artifact by
 * `yarn escape-copy-reader:check`.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  aesGcmEncrypt,
  bytesToBase64,
  deriveKeyFromPassphrase,
  importAesGcmKey,
  randomBytes,
  utf8ToBytes,
  VaultImportError,
  EscapeCopySecretMismatchError,
} from '@myorganizer/vault-core';

import { bootstrap, describeFailure, secretFromForm } from './main';

const TEST_PASSPHRASE = ['page', 'suite', 'phrase'].join('-');
const ITERATIONS = 310_000;

const SHELL = readFileSync(join(__dirname, 'index.html'), 'utf8');

function mountShell(): void {
  const body = SHELL.match(/<body>([\s\S]*?)<\/body>/u)?.[1] ?? '';
  // The `<script>` placeholder is stripped: this suite calls `bootstrap`
  // itself rather than relying on the built bundle's own load-time call.
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/gu, '');
}

async function wrap(key: CryptoKey, plaintext: Uint8Array) {
  const iv = randomBytes(12);
  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(await aesGcmEncrypt({ key, plaintext, iv })),
  };
}

async function mintEnvelopeText(): Promise<string> {
  const salt = randomBytes(16);
  const masterKeyBytes = randomBytes(32);
  const masterKey = await importAesGcmKey(masterKeyBytes);
  const passphraseKey = await deriveKeyFromPassphrase({
    passphrase: TEST_PASSPHRASE,
    salt,
    iterations: ITERATIONS,
  });

  return JSON.stringify({
    schemaVersion: 1,
    exportId: '11111111-2222-4333-8444-555555555555',
    exportedAt: '2026-09-20T09:00:00.000Z',
    meta: {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: bytesToBase64(salt),
      kdf_params: { hash: 'SHA-256', iterations: ITERATIONS },
      wrapped_mk_passphrase: await wrap(passphraseKey, masterKeyBytes),
      wrapped_mk_recovery: await wrap(
        await importAesGcmKey(randomBytes(32)),
        masterKeyBytes,
      ),
    },
    blobs: {
      tasks: await wrap(
        masterKey,
        utf8ToBytes(JSON.stringify({ records: [{ id: 't1' }, { id: 't2' }] })),
      ),
    },
  });
}

/**
 * Puts a file on the input the way a User's file picker would, and waits for
 * the page's own `FileReader` to finish with it.
 */
async function chooseFile(text: string): Promise<void> {
  const input = document.getElementById('envelope-file') as HTMLInputElement;
  const file = new File([text], 'escape-copy.json', {
    type: 'application/json',
  });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));

  const status = document.getElementById('status') as HTMLElement;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (status.textContent?.includes('File loaded')) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error(`File was never read; status said "${status.textContent}"`);
}

async function submitSecret(value: string, kind = 'passphrase'): Promise<void> {
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="secret-kind"][value="${kind}"]`,
  );
  if (radio) radio.checked = true;
  (document.getElementById('secret') as HTMLInputElement).value = value;
  document
    .getElementById('open-form')
    ?.dispatchEvent(new Event('submit', { cancelable: true }));
}

async function settle(predicate: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (predicate()) return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe('secretFromForm', () => {
  it('reads the chosen kind, and reports an empty secret as none', () => {
    expect(secretFromForm({ kind: 'passphrase', value: 'x' })).toEqual({
      kind: 'passphrase',
      value: 'x',
    });
    expect(secretFromForm({ kind: 'recovery-key', value: 'x' })).toEqual({
      kind: 'recovery-key',
      value: 'x',
    });
    expect(secretFromForm({ kind: 'passphrase', value: '' })).toBeNull();
  });
});

describe('describeFailure', () => {
  it('tells a wrong secret apart from a damaged copy', () => {
    const wrongSecret = describeFailure(
      new EscapeCopySecretMismatchError('passphrase'),
    );
    const damaged = describeFailure(
      new VaultImportError('corrupt-file', 'Invalid JSON'),
    );

    expect(wrongSecret).toMatch(/passphrase does not open/iu);
    expect(damaged).toMatch(/not a MyOrganizer Escape Copy|damaged/iu);
    expect(wrongSecret).not.toEqual(damaged);
  });

  it('says to get a newer reader when the copy is from a newer schema', () => {
    expect(
      describeFailure(
        new VaultImportError('unknown-blob-type', 'unsupported blob types'),
      ),
    ).toMatch(/newer reader/iu);
  });
});

describe('the reader page', () => {
  it('opens a copy the User picked and shows every Vault Blob Type', async () => {
    mountShell();
    bootstrap();

    await chooseFile(await mintEnvelopeText());
    await submitSecret(TEST_PASSPHRASE);

    const output = document.getElementById('output') as HTMLElement;
    await settle(
      () => output.querySelectorAll('details.section').length > 0,
      'the reader to render its sections',
    );

    const sections = Array.from(
      output.querySelectorAll('details.section'),
      (element) => (element as HTMLElement).dataset['blobType'],
    );
    expect(sections).toEqual([
      'addresses',
      'groceries',
      'mobileNumbers',
      'subscriptions',
      'tasks',
    ]);

    const tasks = output.querySelector('details[data-blob-type="tasks"]');
    expect(tasks?.querySelector('summary')?.textContent).toMatch(/2 records/u);
    expect(tasks?.querySelector('pre')?.textContent).toContain('t1');
  }, 60_000);

  it('reports a wrong passphrase and renders nothing', async () => {
    mountShell();
    bootstrap();

    await chooseFile(await mintEnvelopeText());
    await submitSecret('not the passphrase');

    const status = document.getElementById('status') as HTMLElement;
    await settle(
      () => /does not open/iu.test(status.textContent ?? ''),
      'the wrong-passphrase message',
    );
    expect(document.getElementById('output')?.children.length).toBe(0);
  }, 60_000);

  it('clears the secret field once an attempt is over', async () => {
    mountShell();
    bootstrap();

    await chooseFile(await mintEnvelopeText());
    await submitSecret(TEST_PASSPHRASE);

    const secret = document.getElementById('secret') as HTMLInputElement;
    await settle(() => secret.value === '', 'the secret field to be cleared');
  }, 60_000);

  it('asks for a file before it asks for a secret', async () => {
    mountShell();
    bootstrap();

    await submitSecret(TEST_PASSPHRASE);

    expect(document.getElementById('status')?.textContent).toMatch(
      /Choose your Escape Copy file first/u,
    );
  });

  it('sends nothing anywhere', async () => {
    mountShell();
    bootstrap();

    // The built page carries no `fetch` at all — `yarn escape-copy-reader:check`
    // asserts that over the artifact. This is the same claim from the other
    // side: nothing the page does in a full successful open calls one.
    const fetchSpy = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;

    await chooseFile(await mintEnvelopeText());
    await submitSecret(TEST_PASSPHRASE);
    await settle(
      () =>
        (document.getElementById('output') as HTMLElement).querySelectorAll(
          'details.section',
        ).length > 0,
      'the reader to render its sections',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  }, 60_000);
});
