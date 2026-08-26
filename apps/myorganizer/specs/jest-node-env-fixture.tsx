/**
 * Stand-in module for `jest-node-env.spec.tsx`, which replaces it with a mock
 * factory containing inline JSX. Only the module's existence matters — the
 * spec never uses this implementation.
 */
export function Marker() {
  return <span data-testid="marker">real</span>;
}
