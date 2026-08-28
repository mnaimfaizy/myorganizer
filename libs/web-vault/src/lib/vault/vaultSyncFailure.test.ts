/**
 * Tests for classifying transport failures from convergeVaultBlob.
 */

import { classifyVaultSyncFailure } from './vaultSyncFailure';

describe('classifyVaultSyncFailure', () => {
  test('401 Unauthorized → session-ended', () => {
    const error = { response: { status: 401 } };
    expect(classifyVaultSyncFailure(error)).toBe('session-ended');
  });

  test('403 Forbidden → session-ended', () => {
    const error = { response: { status: 403 } };
    expect(classifyVaultSyncFailure(error)).toBe('session-ended');
  });

  test('422 Unprocessable Entity → rejected', () => {
    const error = { response: { status: 422 } };
    expect(classifyVaultSyncFailure(error)).toBe('rejected');
  });

  test('500 Internal Server Error → transient', () => {
    const error = { response: { status: 500 } };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('503 Service Unavailable → transient', () => {
    const error = { response: { status: 503 } };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Network error with no response → transient', () => {
    const error = new Error('Network error');
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Unrecognized status 400 → transient (safer default)', () => {
    const error = { response: { status: 400 } };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Unrecognized status 404 → transient (safer default)', () => {
    const error = { response: { status: 404 } };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Unrecognized status 418 (Teapot) → transient (safer default)', () => {
    const error = { response: { status: 418 } };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Error with undefined status → transient', () => {
    const error = { response: {} };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Error with non-numeric status → transient', () => {
    const error = { response: { status: 'not a number' } };
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });

  test('Null error → transient', () => {
    expect(classifyVaultSyncFailure(null)).toBe('transient');
  });

  test('Undefined error → transient', () => {
    expect(classifyVaultSyncFailure(undefined)).toBe('transient');
  });

  test('Error with deeply nested response → transient', () => {
    const error = {};
    expect(classifyVaultSyncFailure(error)).toBe('transient');
  });
});
