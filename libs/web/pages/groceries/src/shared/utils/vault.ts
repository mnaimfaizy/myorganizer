/**
 * Vault operation utilities for grocery list management.
 * Provides consistent error handling and common patterns.
 */

import type { GroceryList } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';

/**
 * Friendly error message for vault operations.
 * Maps technical errors to user-friendly messages.
 */
export function getVaultErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes('decrypt')) {
      return 'Unable to decrypt your data. Your vault key may be invalid.';
    }
    if (lowerMessage.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (lowerMessage.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
  }

  return 'An error occurred while accessing your grocery lists. Please try again.';
}

/**
 * Validates a grocery list name.
 * @param name The name to validate
 * @returns Error message if invalid, null if valid
 */
export function validateGroceryListName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'List name is required';
  }
  if (name.length > 100) {
    return 'List name must be 100 characters or less';
  }
  return null;
}

/**
 * Creates an empty GroceryList with required fields.
 * @param name The list name
 * @returns A new GroceryList object
 */
export function createEmptyGroceryList(name: string): GroceryList {
  return {
    id: randomId(),
    name,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
