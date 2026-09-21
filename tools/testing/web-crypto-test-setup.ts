/**
 * The one Web Crypto / encoding install every vault-adjacent Jest project runs.
 *
 * These suites run the real PBKDF2 and the real AES-GCM rather than stubs —
 * which is the only way a test of the vault says anything about the vault —
 * and the environments they run in do not reliably provide what that needs.
 * jsdom ~22.1 supplies neither `TextEncoder`/`TextDecoder` nor `crypto.subtle`;
 * Jest's node environment does not reliably expose `crypto` either. Node has
 * all of it, so it is installed here.
 *
 * Two projects use it, and they are the two the Escape Copy reader added:
 *
 *   - `libs/vault-core` — `vaultCrypto.ts` and the Escape Copy reader core.
 *   - `apps/escape-copy-reader` — the reader page, against the real
 *     `openEscapeCopy`.
 *
 * Three older projects still keep their own near-identical copy —
 * `libs/web-vault`, `libs/web-vault-ui` and `libs/web/pages/vault` — and that
 * is tracked in
 * [#865](https://github.com/mnaimfaizy/myorganizer/issues/865), not left to a
 * comment. Pointing them here as well works and was tried: all five suites
 * pass. It also pulls four `tsconfig` files and two documents in
 * `docs/testing/projects/` along with it, in projects the Escape Copy reader
 * work does not otherwise touch, which is what makes it its own change rather
 * than a rider on a feature.
 *
 * Referenced by path from each project's `jest.config.ts` rather than imported,
 * so no project takes a module dependency on another project's tree and
 * `@nx/enforce-module-boundaries` has nothing to say about it.
 *
 * Nothing here is a stub. Every function installed is Node's own.
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
  // without a setter in Node and in Jest's own environment, so a plain
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
