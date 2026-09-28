/**
 * Test doubles for the native modules the primitives reach.
 *
 * Each of these has a native half with no JavaScript implementation, so in
 * Jest it throws on import rather than reporting anything. They are stubbed
 * here rather than in each spec so every spec sees the same device, and each
 * stub is the one its own package publishes.
 */
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// The safe-area mock publishes itself as a default export that spreads the
// real module, so the default is what stands in for the module.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
}));
