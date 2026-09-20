/**
 * jsdom setup for the Escape Copy reader's page suite.
 *
 * The page runs the real `openEscapeCopy`, so it needs the real Web Crypto:
 * jsdom ~22.1 provides neither `crypto.subtle` nor `TextEncoder`/`TextDecoder`,
 * and stubbing them would turn a test of the reader into a test of the stub.
 */
import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

type PolyfillableGlobal = {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
  crypto?: { subtle?: unknown; getRandomValues?: unknown };
};

const globals = globalThis as unknown as PolyfillableGlobal;

if (typeof globals.TextEncoder === 'undefined') {
  globals.TextEncoder = TextEncoder;
  globals.TextDecoder = TextDecoder;
}

if (!globals.crypto?.subtle || !globals.crypto?.getRandomValues) {
  // `defineProperty`, not assignment: `globalThis.crypto` is an accessor
  // without a setter, so a plain assignment is silently a no-op.
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
