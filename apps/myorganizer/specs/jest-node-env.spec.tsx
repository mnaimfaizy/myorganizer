/**
 * Guards the `NODE_ENV` pin in `jest.preset.js`.
 *
 * Jest defaults `NODE_ENV` to `test` only when it is unset. Nx loads the
 * workspace-root dotenv file into task environments, so a developer whose
 * dotenv file sets `NODE_ENV=development` had that value reach jest — and
 * under a non-test `NODE_ENV` the `@nx/next/babel` preset switches on its
 * application-build plugins. `babel-preset-jest` hoists `jest.mock` factories
 * above imports, and hoisting one that contains inline JSX then crashed the
 * transform outright:
 *
 *   TypeError: Property declarations[0] of VariableDeclaration expected node
 *   to be of a type ["VariableDeclarator"] but instead got undefined
 *
 * The suite did not fail an assertion, it failed to compile — which reads as a
 * broken test file rather than a broken environment. CI never saw it, having
 * no dotenv file.
 *
 * This file is the regression test, and it works in two ways. The explicit
 * assertion below covers the pin. More importantly, the mock factory itself
 * contains JSX, so if the pin is ever removed this file stops compiling and
 * the suite fails loudly at the exact point the bug reappears.
 */
import '@testing-library/jest-dom';

jest.mock('./jest-node-env-fixture', () => ({
  // Inline JSX in a hoisted factory — the construct that crashed the transform.
  Marker: () => <span data-testid="marker">ok</span>,
}));

import { Marker } from './jest-node-env-fixture';

describe('jest environment', () => {
  it('pins NODE_ENV to test regardless of the ambient value', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('compiles JSX inside a hoisted jest.mock factory', () => {
    expect(Marker).toBeDefined();
  });
});
