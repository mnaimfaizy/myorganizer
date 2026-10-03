// The react-native-web counterpart of `runtime-globals.assert.ts`: asserts that
// the web typecheck program (`tsconfig.web.json`) rejects the globals Node
// provides and a browser does not. That program has an empty `include`, so
// `tsconfig.web.json` names this file in `files`; nothing imports it, so Vite
// never bundles it. See ADR 0120.
//
// `crypto` is not asserted here: `dom` declares it, and a browser has it.

// @ts-expect-error Node global: absent in a browser
void process;
// @ts-expect-error Node global: absent in a browser
void Buffer;

export {};
