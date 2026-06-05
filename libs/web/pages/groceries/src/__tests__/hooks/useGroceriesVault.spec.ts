import { act, renderHook, waitFor } from '@testing-library/react';

// Mock the web-vault functions
jest.mock('@myorganizer/web-vault', () => ({
  loadDecryptedData: jest.fn(),
  saveEncryptedData: jest.fn(),
  normalizeGroceries: jest.fn(),
}));

// Mock the core randomId function
jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(),
}));

import type { GroceryList } from '@myorganizer/core';
import { useGroceriesVault } from '../../hooks/useGroceriesVault';

// Import mocked functions for setup
import { randomId } from '@myorganizer/core';
import {
  loadDecryptedData,
  normalizeGroceries,
  saveEncryptedData,
} from '@myorganizer/web-vault';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Creates a mock Uint8Array for masterKeyBytes (32 bytes for AES-256)
 */
function mockKeyBytes(): Uint8Array {
  return new Uint8Array(32);
}

/**
 * Creates a valid GroceryList object for testing
 */
function mockGroceryList(overrides?: Partial<GroceryList>): GroceryList {
  const now = new Date().toISOString();
  return {
    id: 'list-1',
    name: 'Weekly Groceries',
    items: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a second grocery list for multi-list operations
 */
function mockGroceryList2(overrides?: Partial<GroceryList>): GroceryList {
  const now = new Date().toISOString();
  return {
    id: 'list-2',
    name: 'Pantry Items',
    items: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Mock setup helper that configures loadDecryptedData and normalizeGroceries
 * to work with test data
 */
function setupVaultMocks(
  listData: GroceryList[] = [],
  normalizedChanged = false,
) {
  const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
  const mockNormalizeGroceries = normalizeGroceries as jest.Mock;
  const mockSaveEncryptedData = saveEncryptedData as jest.Mock;

  // Completely reset all mocks before setting new implementations
  mockLoadDecryptedData.mockReset();
  mockNormalizeGroceries.mockReset();
  mockSaveEncryptedData.mockReset();

  mockLoadDecryptedData.mockResolvedValue(listData);
  mockNormalizeGroceries.mockReturnValue({
    value: listData,
    changed: normalizedChanged,
  });
  mockSaveEncryptedData.mockResolvedValue(undefined);

  return {
    mockLoadDecryptedData,
    mockNormalizeGroceries,
    mockSaveEncryptedData,
  };
}

/**
 * Reset all mocks to clean state
 */
function resetAllMocks() {
  jest.resetAllMocks();
  jest.clearAllMocks();
  (loadDecryptedData as jest.Mock).mockReset();
  (saveEncryptedData as jest.Mock).mockReset();
  (normalizeGroceries as jest.Mock).mockReset();
  (randomId as jest.Mock).mockReset();
}

// Global afterEach to ensure mocks are reset between test suites
afterEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Tests: Load Behavior (5 tests)
// ============================================================================

describe('useGroceriesVault - Load Behavior', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('loads lists from vault and normalizes them on mount', async () => {
    const list1 = mockGroceryList();
    const list2 = mockGroceryList2();
    setupVaultMocks([list1, list2]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.lists).toEqual([]);

    // Wait for load to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Vault was queried with correct parameters
    expect(loadDecryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes,
      type: 'groceries',
      defaultValue: [],
    });

    // Lists loaded correctly
    expect(result.current.lists).toEqual([list1, list2]);
    expect(result.current.error).toBeNull();
  });

  test('auto-selects the first list after loading', async () => {
    const list1 = mockGroceryList({ id: 'first-id' });
    const list2 = mockGroceryList2({ id: 'second-id' });
    setupVaultMocks([list1, list2]);

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.selectedListId).toBe('first-id');
  });

  test('re-saves data to vault if normalization changed it (data migration)', async () => {
    const list1 = mockGroceryList();
    const { mockSaveEncryptedData } = setupVaultMocks([list1], true); // changed: true triggers migration

    const keyBytes = mockKeyBytes();
    renderHook(() => useGroceriesVault({ masterKeyBytes: keyBytes }));

    await waitFor(() => {
      expect(mockSaveEncryptedData).toHaveBeenCalled();
    });

    // Verify that the normalized data was saved back
    expect(mockSaveEncryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes,
      type: 'groceries',
      value: [list1],
    });
  });

  test('sets error and loading=false on load failure', async () => {
    const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
    mockLoadDecryptedData.mockRejectedValue(new Error('Vault load failed'));

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load your grocery lists. Please try again.',
    );
    expect(result.current.lists).toEqual([]);
  });

  test('starts with empty array when vault is empty', async () => {
    setupVaultMocks([]);

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists).toEqual([]);
    expect(result.current.selectedListId).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

// ============================================================================
// Tests: Create Operation (4 tests)
// ============================================================================

describe('useGroceriesVault - Create Operation', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('creates a new list, adds to state, and saves to vault', async () => {
    const existingList = mockGroceryList({ id: 'existing-id' });
    const { mockSaveEncryptedData } = setupVaultMocks([existingList]);
    (randomId as jest.Mock).mockReturnValue('new-list-id');

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const before = result.current.lists.length;

    // Create a new list
    await act(async () => {
      await result.current.createList('New Groceries');
    });

    // Check that the list was added
    expect(result.current.lists).toHaveLength(before + 1);
    const newList = result.current.lists.find((l) => l.id === 'new-list-id');
    expect(newList).toBeDefined();
    expect(newList?.name).toBe('New Groceries');
    expect(newList?.items).toEqual([]);

    // Verify saveEncryptedData was called
    expect(mockSaveEncryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes,
      type: 'groceries',
      value: expect.arrayContaining([
        existingList,
        expect.objectContaining({
          id: 'new-list-id',
          name: 'New Groceries',
        }),
      ]),
    });
  });

  test('auto-selects the newly created list', async () => {
    setupVaultMocks([]);
    (randomId as jest.Mock).mockReturnValue('new-list-id');

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createList('My First List');
    });

    expect(result.current.selectedListId).toBe('new-list-id');
  });

  test('assigns unique ID to each created list', async () => {
    const { mockSaveEncryptedData } = setupVaultMocks([]);
    const mockRandomId = randomId as jest.Mock;
    mockRandomId
      .mockReturnValueOnce('id-1')
      .mockReturnValueOnce('id-2')
      .mockReturnValueOnce('id-3');

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Create first list
    await act(async () => {
      await result.current.createList('List 1');
    });

    // Verify saveEncryptedData was called
    expect(mockSaveEncryptedData).toHaveBeenCalled();

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].id).toBe('id-1');

    // Create second list
    await act(async () => {
      await result.current.createList('List 2');
    });

    expect(result.current.lists).toHaveLength(2);
    expect(result.current.lists[1].id).toBe('id-2');

    // Create third list
    await act(async () => {
      await result.current.createList('List 3');
    });

    expect(result.current.lists).toHaveLength(3);
    expect(result.current.lists[2].id).toBe('id-3');

    const ids = result.current.lists.map((l) => l.id);
    expect(ids).toEqual(['id-1', 'id-2', 'id-3']);
    expect(new Set(ids).size).toBe(3); // All unique
  });

  test('handles save error by setting error state', async () => {
    // Setup basic successful load, but failing save
    const { mockSaveEncryptedData } = setupVaultMocks([]);

    const saveError = new Error('Save failed');
    mockSaveEncryptedData.mockRejectedValueOnce(saveError);
    (randomId as jest.Mock).mockReturnValue('new-list-id');

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // createList catches the error from persistLists
    // persistLists sets error message before throwing
    await act(async () => {
      try {
        await result.current.createList('New List');
      } catch {
        // Expected to catch error from persistLists
      }
    });

    // Error message should be set by persistLists
    expect(result.current.error).toBe(
      'Failed to save your changes. Please try again.',
    );
  });
});

// ============================================================================
// Tests: Rename Operation (4 tests)
// ============================================================================

describe('useGroceriesVault - Rename Operation', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('renames a list and updates state', async () => {
    const list = mockGroceryList({ id: 'list-1', name: 'Original Name' });
    setupVaultMocks([list]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.renameList('list-1', 'New Name');
    });

    const renamedList = result.current.lists.find((l) => l.id === 'list-1');
    expect(renamedList?.name).toBe('New Name');
  });

  test('updates the updatedAt timestamp when renaming', async () => {
    const originalTime = '2025-01-01T00:00:00.000Z';
    const list = mockGroceryList({
      id: 'list-1',
      name: 'Original',
      updatedAt: originalTime,
    });
    setupVaultMocks([list]);

    // Mock current time for the rename operation
    const mockNow = '2025-01-02T10:30:00.000Z';
    const originalToISOString = Date.prototype.toISOString;
    Date.prototype.toISOString = jest.fn(function () {
      // Return different values: first call(s) for the initial load, then mockNow for rename
      if (this.getTime() === new Date(originalTime).getTime()) {
        return originalTime;
      }
      return mockNow;
    });

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.renameList('list-1', 'Updated Name');
    });

    const renamedList = result.current.lists.find((l) => l.id === 'list-1');
    expect(renamedList?.updatedAt).toBe(mockNow);

    // Restore original toISOString
    Date.prototype.toISOString = originalToISOString;
  });

  test('persists rename to vault', async () => {
    const list = mockGroceryList({ id: 'list-1' });
    const { mockSaveEncryptedData } = setupVaultMocks([list]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.renameList('list-1', 'New Name');
    });

    expect(mockSaveEncryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes,
      type: 'groceries',
      value: expect.arrayContaining([
        expect.objectContaining({
          id: 'list-1',
          name: 'New Name',
        }),
      ]),
    });
  });

  test('handles save error on rename', async () => {
    const list = mockGroceryList({ id: 'list-1' });
    const { mockSaveEncryptedData } = setupVaultMocks([list]);

    mockSaveEncryptedData.mockRejectedValue(new Error('Save failed'));

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Rename should catch error from persistLists
    await act(async () => {
      await result.current.renameList('list-1', 'New Name');
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        'Failed to save your changes. Please try again.',
      );
    });
  });
});

// ============================================================================
// Tests: Delete Operation (4 tests)
// ============================================================================

describe('useGroceriesVault - Delete Operation', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('deletes a list from state', async () => {
    const list1 = mockGroceryList({ id: 'list-1' });
    const list2 = mockGroceryList2({ id: 'list-2' });
    setupVaultMocks([list1, list2]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists).toHaveLength(2);

    await act(async () => {
      await result.current.deleteList('list-1');
    });

    await waitFor(() => {
      expect(result.current.lists).toHaveLength(1);
      expect(result.current.lists[0].id).toBe('list-2');
    });
  });

  test('selects next list if deleted list was selected', async () => {
    const list1 = mockGroceryList({ id: 'list-1' });
    const list2 = mockGroceryList2({ id: 'list-2' });
    setupVaultMocks([list1, list2]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First list is selected by default
    expect(result.current.selectedListId).toBe('list-1');

    // Delete the selected list
    await act(async () => {
      await result.current.deleteList('list-1');
    });

    // Next list should be selected
    await waitFor(() => {
      expect(result.current.selectedListId).toBe('list-2');
    });
  });

  test('sets selectedListId to null when deleting the last list', async () => {
    const list = mockGroceryList({ id: 'only-list' });
    setupVaultMocks([list]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.selectedListId).toBe('only-list');

    await act(async () => {
      await result.current.deleteList('only-list');
    });

    await waitFor(() => {
      expect(result.current.selectedListId).toBeNull();
      expect(result.current.lists).toHaveLength(0);
    });
  });

  test('persists deletion to vault', async () => {
    const list1 = mockGroceryList({ id: 'list-1' });
    const list2 = mockGroceryList2({ id: 'list-2' });
    const { mockSaveEncryptedData } = setupVaultMocks([list1, list2]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteList('list-1');
    });

    expect(mockSaveEncryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes,
      type: 'groceries',
      value: [list2],
    });
  });
});

// ============================================================================
// Tests: Error States (3 tests)
// ============================================================================

describe('useGroceriesVault - Error States', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('clears error when a new operation succeeds', async () => {
    // First setup: failed load to trigger error
    (loadDecryptedData as jest.Mock).mockRejectedValueOnce(
      new Error('Load failed'),
    );
    (normalizeGroceries as jest.Mock).mockReturnValue({
      value: [],
      changed: false,
    });
    (randomId as jest.Mock).mockReturnValue('new-id');
    (saveEncryptedData as jest.Mock).mockResolvedValueOnce(undefined);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    // Wait for load to fail and error to be set
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load your grocery lists. Please try again.',
    );

    // Perform an operation - error should clear when persistLists calls setError(null)
    await act(async () => {
      await result.current.createList('New List');
    });

    // Error should be cleared by setError(null) at the start of persistLists
    expect(result.current.error).toBeNull();
  });

  test('error persists until explicitly dismissed via setError', async () => {
    setupVaultMocks([]);
    (loadDecryptedData as jest.Mock).mockRejectedValue(
      new Error('Load failed'),
    );

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const errorMessage = result.current.error;
    expect(errorMessage).not.toBeNull();

    // Error persists
    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    // Dismiss error
    act(() => {
      result.current.setError(null);
    });

    expect(result.current.error).toBeNull();
  });

  test('latest error overwrites previous error', async () => {
    setupVaultMocks([]);

    const keyBytes = mockKeyBytes();
    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: keyBytes }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set first error
    act(() => {
      result.current.setError('First error');
    });

    expect(result.current.error).toBe('First error');

    // Set second error - should overwrite
    act(() => {
      result.current.setError('Second error');
    });

    expect(result.current.error).toBe('Second error');
  });
});

// ============================================================================
// Tests: State Management (2 tests)
// ============================================================================

describe('useGroceriesVault - State Management', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('loading state resolves to false after load completes', async () => {
    const list = mockGroceryList();
    setupVaultMocks([list]);

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.loading).toBe(false);
  });

  test('useCallback dependencies are correct (masterKeyBytes changes trigger reload)', async () => {
    const list1 = mockGroceryList({ id: 'list-1' });
    setupVaultMocks([list1]);

    const keyBytes1 = mockKeyBytes();
    const { rerender } = renderHook(
      ({ keyBytes }) => useGroceriesVault({ masterKeyBytes: keyBytes }),
      {
        initialProps: { keyBytes: keyBytes1 },
      },
    );

    const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
    expect(mockLoadDecryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes1,
      type: 'groceries',
      defaultValue: [],
    });

    // Change key bytes and re-render - should trigger new load
    const keyBytes2 = new Uint8Array(32);
    keyBytes2[0] = 1; // Different from keyBytes1

    mockLoadDecryptedData.mockClear();
    rerender({ keyBytes: keyBytes2 });

    await waitFor(() => {
      expect(mockLoadDecryptedData).toHaveBeenCalled();
    });

    expect(mockLoadDecryptedData).toHaveBeenCalledWith({
      masterKeyBytes: keyBytes2,
      type: 'groceries',
      defaultValue: [],
    });
  });
});
