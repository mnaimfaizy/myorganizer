/**
 * Test environment setup for the vault-core suites.
 *
 * `vaultCrypto.ts` reaches the standard Web Crypto API and the standard
 * `btoa`/`atob`/`TextEncoder` globals and nothing else — that is what makes it
 * bundleable into a single-file Escape Copy reader with no dependency to
 * fetch. Jest's environment does not reliably expose all of them, so Node's
 * own are installed here rather than at the top of every suite that touches
 * crypto.
 *
 * Nothing is stubbed. These suites run the real PBKDF2 and the real AES-GCM,
 * which is the only way a test of the reader says anything about the reader.
 */
import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

type PolyfillableGlobal = {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
  crypto?: { subtle?: unknown; getRandomValues?: unknown };
  btoa?: (data: string) => string;
  atob?: (data: string) => string;
};

const globals = globalThis as unknown as PolyfillableGlobal;

if (typeof globals.TextEncoder === 'undefined') {
  globals.TextEncoder = TextEncoder;
  globals.TextDecoder = TextDecoder;
}

if (!globals.crypto?.subtle || !globals.crypto?.getRandomValues) {
  // `defineProperty`, not assignment: `globalThis.crypto` is an accessor
  // without a setter in both Node and jest's own environment, so a plain
  // assignment is silently a no-op under a non-strict transform — which reads
  // as "Web Crypto is missing" rather than "the install did not take".
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

if (typeof globals.btoa === 'undefined') {
  globals.btoa = (data: string) =>
    Buffer.from(data, 'binary').toString('base64');
  globals.atob = (data: string) =>
    Buffer.from(data, 'base64').toString('binary');
}
