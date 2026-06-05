import type { GroceryList } from '@myorganizer/core';
import {
  createEmptyGroceryList,
  getVaultErrorMessage,
  validateGroceryListName,
} from '../../utils/vault';

describe('vault utilities', () => {
  describe('validateGroceryListName', () => {
    it('should accept valid list names (1-100 characters)', () => {
      expect(validateGroceryListName('Groceries')).toBeNull();
      expect(validateGroceryListName('Weekly Shopping')).toBeNull();
      expect(validateGroceryListName('a')).toBeNull(); // 1 char minimum
      expect(validateGroceryListName('a'.repeat(100))).toBeNull(); // 100 char maximum
    });

    it('should reject empty names', () => {
      expect(validateGroceryListName('')).toBe('List name is required');
      expect(validateGroceryListName('   ')).toBe('List name is required');
      expect(validateGroceryListName('\t\n')).toBe('List name is required');
    });

    it('should reject names longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      const error = validateGroceryListName(longName);
      expect(error).toBe('List name must be 100 characters or less');
    });

    it('should trim whitespace before validation', () => {
      expect(validateGroceryListName('  Valid Name  ')).toBeNull();
      expect(validateGroceryListName('\tWhitespace\n')).toBeNull();
    });

    it('should handle special characters', () => {
      expect(validateGroceryListName('List #1')).toBeNull();
      expect(validateGroceryListName('Café & Bakery')).toBeNull();
      expect(validateGroceryListName('📝 Shopping')).toBeNull();
    });

    it('should handle unicode characters within length limits', () => {
      // Emoji counts as 1 character in JavaScript string length
      const name = '🛒'.repeat(50); // 50 emojis = 50 chars
      expect(validateGroceryListName(name)).toBeNull();

      const tooLong = '🛒'.repeat(101); // 101 emojis = 101 chars
      expect(validateGroceryListName(tooLong)).toBe(
        'List name must be 100 characters or less',
      );
    });
  });

  describe('getVaultErrorMessage', () => {
    it('should return friendly message for decrypt errors', () => {
      const error = new Error('Unable to decrypt with key mismatch');
      expect(getVaultErrorMessage(error)).toBe(
        'Unable to decrypt your data. Your vault key may be invalid.',
      );
    });

    it('should return friendly message for network errors', () => {
      const error = new Error('Network request failed');
      expect(getVaultErrorMessage(error)).toBe(
        'Network error. Please check your connection and try again.',
      );
    });

    it('should return friendly message for timeout errors', () => {
      const error = new Error('Request timeout');
      expect(getVaultErrorMessage(error)).toBe(
        'Request timed out. Please try again.',
      );
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Some random error');
      expect(getVaultErrorMessage(error)).toBe(
        'An error occurred while accessing your grocery lists. Please try again.',
      );
    });

    it('should handle non-Error objects gracefully', () => {
      expect(getVaultErrorMessage('string error')).toBe(
        'An error occurred while accessing your grocery lists. Please try again.',
      );
      expect(getVaultErrorMessage(null)).toBe(
        'An error occurred while accessing your grocery lists. Please try again.',
      );
      expect(getVaultErrorMessage(undefined)).toBe(
        'An error occurred while accessing your grocery lists. Please try again.',
      );
      expect(getVaultErrorMessage({ message: 'object error' })).toBe(
        'An error occurred while accessing your grocery lists. Please try again.',
      );
    });

    it('should be case-insensitive for error message detection', () => {
      const decryptError = new Error('DECRYPT failed');
      expect(getVaultErrorMessage(decryptError)).toBe(
        'Unable to decrypt your data. Your vault key may be invalid.',
      );

      const networkError = new Error('NETWORK connection lost');
      expect(getVaultErrorMessage(networkError)).toBe(
        'Network error. Please check your connection and try again.',
      );

      const timeoutError = new Error('TIMEOUT occurred');
      expect(getVaultErrorMessage(timeoutError)).toBe(
        'Request timed out. Please try again.',
      );
    });

    it('should prioritize first matching error type', () => {
      // If message contains both 'decrypt' and 'network', decrypt takes precedence
      const error = new Error('Decrypt network error combined');
      const message = getVaultErrorMessage(error);
      expect(message).toBe(
        'Unable to decrypt your data. Your vault key may be invalid.',
      );
    });
  });

  describe('createEmptyGroceryList', () => {
    it('should create a valid GroceryList with all required fields', () => {
      const list = createEmptyGroceryList('Test List');

      expect(list).toHaveProperty('id');
      expect(list).toHaveProperty('name', 'Test List');
      expect(list).toHaveProperty('items');
      expect(list).toHaveProperty('createdAt');
      expect(list).toHaveProperty('updatedAt');
    });

    it('should generate a unique ID for each list', () => {
      const list1 = createEmptyGroceryList('List 1');
      const list2 = createEmptyGroceryList('List 2');

      expect(list1.id).not.toBe(list2.id);
    });

    it('should initialize with empty items array', () => {
      const list = createEmptyGroceryList('Empty List');
      expect(list.items).toEqual([]);
      expect(Array.isArray(list.items)).toBe(true);
    });

    it('should set createdAt and updatedAt to current time', () => {
      const beforeCreation = new Date();
      const list = createEmptyGroceryList('Time Test');
      const afterCreation = new Date();

      const createdAt = new Date(list.createdAt);
      const updatedAt = new Date(list.updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreation.getTime(),
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreation.getTime(),
      );
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should set createdAt and updatedAt to the same time on creation', () => {
      const list = createEmptyGroceryList('Sync Test');
      expect(list.createdAt).toBe(list.updatedAt);
    });

    it('should use provided name exactly', () => {
      const names = [
        'Simple',
        'With Spaces',
        'Special!@#$%Chars',
        'Numbers123',
        'UPPERCASE',
        'lowercase',
        'MiXeD-CaSe_With-Dashes',
        '📝 Emoji List',
      ];

      for (const name of names) {
        const list = createEmptyGroceryList(name);
        expect(list.name).toBe(name);
      }
    });

    it('should return a properly typed GroceryList', () => {
      const list: GroceryList = createEmptyGroceryList('Type Test');

      // These assignments would fail TypeScript compilation if types are wrong
      const id: string = list.id;
      const name: string = list.name;
      const items: unknown[] = list.items;
      const createdAt: string = list.createdAt;
      const updatedAt: string = list.updatedAt;

      expect([id, name, items, createdAt, updatedAt]).toBeDefined();
    });

    it('should format timestamps as ISO 8601 strings', () => {
      const list = createEmptyGroceryList('ISO Test');

      // ISO 8601 format check: YYYY-MM-DDTHH:mm:ss.sssZ or similar
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      expect(list.createdAt).toMatch(iso8601Regex);
      expect(list.updatedAt).toMatch(iso8601Regex);
    });

    it('should work with empty string (after normalization)', () => {
      // Edge case: empty name after normalization
      // Validation should catch this, but factory should still work
      const list = createEmptyGroceryList('');
      expect(list.name).toBe('');
      expect(list.id).toBeDefined();
    });

    it('should work with maximum length name', () => {
      const maxName = 'a'.repeat(100);
      const list = createEmptyGroceryList(maxName);
      expect(list.name).toBe(maxName);
      expect(list.id).toBeDefined();
    });
  });

  describe('utility functions integration', () => {
    it('should validate and then create a list', () => {
      const name = 'My List';
      const error = validateGroceryListName(name);
      expect(error).toBeNull();

      const list = createEmptyGroceryList(name);
      expect(list.name).toBe(name);
    });

    it('should handle error message for creation with invalid vault state', () => {
      const decryptError = new Error('decrypt failed');
      const message = getVaultErrorMessage(decryptError);
      expect(message).toContain('vault key');
    });
  });
});
