export * from './generated/tokens';

// `generated/tailwind-preset.native.js` is deliberately NOT re-exported. It is a
// CommonJS Tailwind/NativeWind config consumed by build tooling, not runtime
// token values, and nothing in the repository imports the symbol. Re-exporting
// it dragged `module.exports = {...}` into every browser bundle that reaches
// this index — which is what broke the Email Shell Storybook chunk in Chromatic
// with `Cannot set properties of undefined (setting 'exports')`. Import the
// generated file by path from a build config if one ever needs it.
