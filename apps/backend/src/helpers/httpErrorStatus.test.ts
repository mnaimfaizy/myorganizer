import { describe, expect, test } from '@jest/globals';

import { getHttpErrorMessage, getHttpErrorStatus } from './httpErrorStatus';

describe('getHttpErrorStatus', () => {
  test('returns undefined for non-object inputs', () => {
    expect(getHttpErrorStatus(null)).toBeUndefined();
    expect(getHttpErrorStatus(undefined)).toBeUndefined();
    expect(getHttpErrorStatus('401')).toBeUndefined();
    expect(getHttpErrorStatus(401)).toBeUndefined();
  });

  test('returns undefined for non-numeric status fields', () => {
    expect(getHttpErrorStatus({ status: '401' })).toBeUndefined();
    expect(getHttpErrorStatus({ statusCode: '500' })).toBeUndefined();
  });

  test('returns undefined for non-integer status', () => {
    expect(getHttpErrorStatus({ status: 401.5 })).toBeUndefined();
  });

  test('returns undefined for status below 400 or above 599', () => {
    expect(getHttpErrorStatus({ status: 399 })).toBeUndefined();
    expect(getHttpErrorStatus({ status: 600 })).toBeUndefined();
  });

  test('returns 400 and 599 at inclusive bounds', () => {
    expect(getHttpErrorStatus({ status: 400 })).toBe(400);
    expect(getHttpErrorStatus({ status: 599 })).toBe(599);
  });

  test('returns in-range integer status', () => {
    expect(getHttpErrorStatus({ status: 401 })).toBe(401);
  });

  test('falls back to statusCode when status is absent', () => {
    expect(getHttpErrorStatus({ statusCode: 404 })).toBe(404);
  });

  test('prefers status over statusCode', () => {
    expect(getHttpErrorStatus({ status: 401, statusCode: 500 })).toBe(401);
  });
});

describe('getHttpErrorMessage', () => {
  test('returns non-empty string message from object', () => {
    expect(getHttpErrorMessage({ message: 'Forbidden' })).toBe('Forbidden');
  });

  test("returns 'Request failed' when message is missing, empty, or non-string", () => {
    expect(getHttpErrorMessage({})).toBe('Request failed');
    expect(getHttpErrorMessage({ message: '' })).toBe('Request failed');
    expect(getHttpErrorMessage({ message: 12 })).toBe('Request failed');
  });

  test("returns 'Request failed' for non-object inputs", () => {
    expect(getHttpErrorMessage(null)).toBe('Request failed');
    expect(getHttpErrorMessage('x')).toBe('Request failed');
  });
});
