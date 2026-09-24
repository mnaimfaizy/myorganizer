// Portable Entry Point (see CONTEXT.md): `@myorganizer/auth/portable`.
//
// Carries only exports that hold on every runtime the Mobile App targets. The
// main entry point (`./index.ts`) reaches the browser session storage adapter
// and, through the transport adapter, `@myorganizer/core`'s `window`/`document`
// helpers — none of which exist on React Native, where `typeof window` guards
// do not help because React Native sets `global.window = global`.
//
// Mobile native code imports this library only through this file. The mobile
// native typecheck program has no `dom` in `lib`, and `yarn mobile-platform:check`
// fails a mobile import of `@myorganizer/auth` while this entry exists
// (ADR 0103). Anything re-exported here must not reach a browser global.
export * from './lib/refresh-client-contract';
