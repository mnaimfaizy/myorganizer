/**
 * jsdom environment setup for the web-vault-ui suites.
 *
 * The vault gate suites reach real crypto through the vault handle, and
 * jsdom ~22.1 provides neither `TextEncoder`/`TextDecoder` nor `crypto.subtle`.
 * Node supplies both, so install them once here instead of repeating the block
 * at the top of each spec file.
 */

import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

type PolyfillableGlobal = {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
  crypto?: { subtle?: unknown };
};

const globals = globalThis as unknown as PolyfillableGlobal;

if (typeof globals.TextEncoder === 'undefined') {
  globals.TextEncoder = TextEncoder;
  globals.TextDecoder = TextDecoder;
}

if (!globals.crypto?.subtle) {
  if (!globals.crypto) {
    globals.crypto = {};
  }
  globals.crypto.subtle = webcrypto.subtle;
}
