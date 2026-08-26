// Jest sets NODE_ENV to 'test' only when it is not already set. Nx loads the
// workspace-root dotenv file into every task environment, so a developer whose
// dotenv file sets NODE_ENV=development has that value leak into jest runs.
//
// That is not cosmetic. Under a non-test NODE_ENV the `@nx/next/babel` preset
// switches on its application-build plugins, and babel-preset-jest's hoisting
// of a `jest.mock` factory containing inline JSX then crashes the transform
// with "Property declarations[0] of VariableDeclaration expected node to be of
// a type ["VariableDeclarator"] but instead got undefined". The suite does not
// fail an assertion — it fails to compile, which reads as a broken test file
// rather than a broken environment.
//
// CI never saw it: no dotenv file there, so NODE_ENV was unset and jest's own
// default applied. Pin it here so a jest run means the same thing everywhere.
//
// This must run before jest forks its workers, which it does — the preset is
// required during config resolution in the main process, and workers inherit
// process.env at spawn.
process.env.NODE_ENV = 'test';

const nxPreset = require('@nx/jest/preset').default;

module.exports = { ...nxPreset };
