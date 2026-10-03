// Asserts that the native typecheck program (`tsconfig.app.json`) rejects the
// globals Node provides and Hermes does not. Nothing imports this file, so
// Metro never bundles it; it exists for the compiler alone.
//
// Each directive below is satisfied only while the name underneath it fails to
// resolve. If Node types come back by any route — a `types: ["node"]` entry, a
// deleted `types` key (TypeScript then auto-includes every `@types/*` package),
// or a dependency's `/// <reference types="node" />` — the directives become
// unused and `yarn nx run mobile:typecheck` fails here. See ADR 0120.
//
// A name mobile code needs is imported from a package that provides it, or,
// for a global Hermes itself provides, declared in
// `libs/mobile/native-globals.d.ts`. It is never admitted by restoring `node`.

// @ts-expect-error Node global: absent on Hermes
void process;
// @ts-expect-error Node global: absent on Hermes
void Buffer;
// @ts-expect-error Absent on Hermes; `react-native-quick-crypto` is imported, not installed as a global
void crypto;

export {};
