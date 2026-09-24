// Portable Entry Point (see CONTEXT.md): `@myorganizer/vault-core/portable`.
//
// Carries only exports that hold on every runtime the Mobile App targets. The
// main entry point (`./index.ts`) also carries `vaultCrypto.ts` and the Escape
// Copy reader, which run WebCrypto and stay in this library on purpose
// (ADR 0039, ADR 0064) — mobile reaches the same suite through the
// `VaultCrypto` interface instead.
//
// Mobile native code imports this library only through this file. The mobile
// native typecheck program has no `dom` in `lib`, and `yarn mobile-platform:check`
// fails a mobile import of `@myorganizer/vault-core` while this entry exists
// (ADR 0103). Anything re-exported here must not reach a browser global.
export * from './lib/interfaces';
export * from './lib/types';
