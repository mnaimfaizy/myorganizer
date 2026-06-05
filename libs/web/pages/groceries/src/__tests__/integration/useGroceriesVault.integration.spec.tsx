// Integration tests for useGroceriesVault focusing on vault workflows
// and state consistency that the hook explicitly implements.

// Mock the web-vault module before any imports (Nx/Jest rule)
jest.mock('@myorganizer/web-vault', () => {
  const loadDecryptedData = jest.fn();
  const saveEncryptedData = jest.fn();
  const normalizeGroceries = jest.fn((raw: unknown) => ({
    value: Array.isArray(raw) ? raw : [],
    changed: false,
  }));

  return {
    loadDecryptedData,
    saveEncryptedData,
    normalizeGroceries,
  };
});

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(),
}));

import type { GroceryList } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import {
  loadDecryptedData,
  normalizeGroceries,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useGroceriesVault } from '../../shared/hooks/useGroceriesVault';

// -----------------------------
// Test Helpers
// -----------------------------

function mockKeyBytes(): Uint8Array {
  return new Uint8Array(32);
}

function createMockGroceryList(overrides?: Partial<GroceryList>): GroceryList {
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? `list-${Math.random().toString(36).slice(2, 9)}`,
    name: overrides?.name ?? 'Test List',
    items: overrides?.items ?? [],
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  } as GroceryList;
}

type VaultBehavior = {
  load?: { value?: unknown; delayMs?: number; error?: unknown };
  save?: { delayMs?: number; error?: unknown };
};

function createMockVaultClient() {
  const mockLoad = loadDecryptedData as jest.MockedFunction<any>;
  const mockSave = saveEncryptedData as jest.MockedFunction<any>;
  const mockNormalize = normalizeGroceries as jest.MockedFunction<any>;

  function configureBehavior(beh: VaultBehavior = {}) {
    mockLoad.mockReset();
    mockSave.mockReset();
    mockNormalize.mockReset();

    // Default normalize behavior: passthrough value
    mockNormalize.mockImplementation((raw: unknown) => ({
      value: Array.isArray(raw) ? raw : [],
      changed: false,
    }));

    if (beh.load) {
      const { value = [], delayMs = 0, error } = beh.load;
      mockLoad.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => (error ? reject(error) : resolve(value)), delayMs);
          }),
      );
    } else {
      mockLoad.mockResolvedValue([]);
    }

    if (beh.save) {
      const { delayMs = 0, error } = beh.save;
      mockSave.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(
              () => (error ? reject(error) : resolve(undefined)),
              delayMs,
            );
          }),
      );
    } else {
      mockSave.mockResolvedValue(undefined);
    }

    return {
      mockLoad,
      mockSave,
      mockNormalize,
      reset() {
        mockLoad.mockReset();
        mockSave.mockReset();
        mockNormalize.mockReset();
      },
    };
  }

  return { configureBehavior };
}

async function expectListsInState(result: any, expectedNames: string[]) {
  await waitFor(() => {
    expect(result.current.lists.map((l: GroceryList) => l.name)).toEqual(
      expectedNames,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Make randomId deterministic in most tests unless explicitly overridden
  (randomId as jest.MockedFunction<any>).mockImplementation(
    () => `rid-${Math.floor(Math.random() * 1e6)}`,
  );
});

// -----------------------------
// Integration Tests
// -----------------------------

describe('useGroceriesVault - Integration: Hook Initialization', () => {
  const vault = createMockVaultClient();

  test('loads initial vault data on mount', async () => {
    const list = createMockGroceryList({ id: 'init-1', name: 'Init List' });
    const { mockLoad } = vault.configureBehavior({ load: { value: [list] } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockLoad).toHaveBeenCalled();
    expect(result.current.lists).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  test('initializes with empty vault when no data', async () => {
    vault.configureBehavior({ load: { value: [] } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lists).toEqual([]);
    expect(result.current.selectedListId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('initializes with populated vault data and auto-selects first', async () => {
    const a = createMockGroceryList({ id: 'a', name: 'A' });
    const b = createMockGroceryList({ id: 'b', name: 'B' });
    vault.configureBehavior({ load: { value: [a, b] } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lists.map((l: GroceryList) => l.id)).toEqual([
      'a',
      'b',
    ]);
    expect(result.current.selectedListId).toBe('a');
  });

  test('loadError is null on successful load even with delays', async () => {
    const list = createMockGroceryList({ id: 'delayed' });
    vault.configureBehavior({ load: { value: [list], delayMs: 50 } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});

describe('useGroceriesVault - Integration: Complete User Workflows', () => {
  const vault = createMockVaultClient();

  test('create list workflow: load -> create -> save', async () => {
    const existing = createMockGroceryList({ id: 'e1', name: 'Existing' });
    const { mockSave } = vault.configureBehavior({
      load: { value: [existing] },
    });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createList('New List');
    });

    // New list present and save called with both lists
    expect(
      result.current.lists.some((l: GroceryList) => l.name === 'New List'),
    ).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });

  test('rename list workflow persists changes', async () => {
    const list = createMockGroceryList({ id: 'r1', name: 'Old' });
    const { mockSave } = vault.configureBehavior({ load: { value: [list] } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.renameList('r1', 'Renamed');
    });

    expect(
      result.current.lists.find((l: GroceryList) => l.id === 'r1')?.name,
    ).toBe('Renamed');
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.arrayContaining([
          expect.objectContaining({ id: 'r1', name: 'Renamed' }),
        ]),
      }),
    );
  });

  test('delete list workflow removes and persists', async () => {
    const l1 = createMockGroceryList({ id: 'd1', name: 'One' });
    const l2 = createMockGroceryList({ id: 'd2', name: 'Two' });
    const { mockSave } = vault.configureBehavior({ load: { value: [l1, l2] } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteList('d1');
    });

    expect(
      result.current.lists.find((l: GroceryList) => l.id === 'd1'),
    ).toBeUndefined();
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ value: [l2] }),
    );
  });
});

describe('useGroceriesVault - Integration: Vault Data Integrity', () => {
  const vault = createMockVaultClient();

  test('after create, list appears in next state render', async () => {
    vault.configureBehavior({ load: { value: [] } });
    (randomId as jest.MockedFunction<any>).mockReturnValueOnce('i1');

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createList('IList');
    });

    expect(
      result.current.lists.find((l: GroceryList) => l.id === 'i1'),
    ).toBeDefined();
  });

  test('list order preserved across operations', async () => {
    const l1 = createMockGroceryList({ id: 'o1', name: 'One' });
    const l2 = createMockGroceryList({ id: 'o2', name: 'Two' });
    vault.configureBehavior({ load: { value: [l1, l2] } });

    const { result } = renderHook(() =>
      useGroceriesVault({ masterKeyBytes: mockKeyBytes() }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Rename first and ensure order stays
    await act(async () => {
      await result.current.renameList('o1', 'One-R');
    });

    expect(result.current.lists.map((l: GroceryList) => l.id)).toEqual([
      'o1',
      'o2',
    ]);
  });
});
