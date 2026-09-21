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
 * Every vault-adjacent Jest project uses it:
 *
 *   - `libs/vault-core` — `vaultCrypto.ts` and the Escape Copy reader core.
 *   - `apps/escape-copy-reader` — the reader page, against the real
 *     `openEscapeCopy`.
 *   - `libs/web-vault` — the vault handle and its sync collaborators.
 *   - `libs/web-vault-ui` — the gate suites that drive a real handle.
 *   - `libs/web/pages/vault` — the page suites that drive a real handle.
 *
 * The last three arrived here from their own near-identical `src/test-setup.ts`
 * copies in [#865](https://github.com/mnaimfaizy/myorganizer/issues/865). Those
 * files are gone; do not reintroduce a per-project copy.
 *
 * Referenced by path from each project's `jest.config.ts` rather than imported,
 * so no project takes a module dependency on another project's tree and
 * `@nx/enforce-module-boundaries` has nothing to say about it.
 *
 * That reference is also what keeps the Nx cache honest: the inferred
 * `@nx/jest` plugin reads `setupFilesAfterEnv` and adds the resolved path to
 * each `test` target's inputs as `{workspaceRoot}/tools/testing/...`, so
 * editing this file invalidates all five. It needs no `sharedGlobals` entry in
 * `nx.json`, and adding one would be strictly worse — `sharedGlobals` is an
 * input of every project, so it would invalidate the whole workspace.
 *
 * Nothing imports it, so it matches no consumer's tsconfig `include` either.
 * `tools/tsconfig.spec.json` includes `testing/**` for that reason; without it
 * `yarn typecheck:check` compiles every other TypeScript file in the workspace
 * and not this one.
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
