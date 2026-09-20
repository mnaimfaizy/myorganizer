/* eslint-disable import/first -- jest.mock must precede application imports */

/**
 * Mock web-vault-ui hooks before importing the tested hook.
 */
jest.mock('@myorganizer/web-vault-ui', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import {
  createVaultHandle,
  VAULT_BLOB_FIELDS,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';

import { useUnsentVaultBlobTypes } from './useUnsentVaultBlobTypes';

/**
 * `createVaultHandle` is deliberately real, not a hand-built fake: this suite
 * exists because #702 found nothing proving `hasUnsentChanges` itself derives
 * the right answer. A stubbed `hasUnsentChanges` would only prove a stub
 * returns what it was told to return — the same tautology `saveEncryptedData`
 * requires an unlocked handle, so seeding real Ciphertext through the public
 * API costs the real PBKDF2 unlock too; there is no lighter public entry point.
 */
const TEST_OWNER = 'test-owner';
const TEST_PASSPHRASE = 'unit-test-pass';

async function createUnlockedHandle(
  owner: string = TEST_OWNER,
): Promise<VaultHandle> {
  const handle = createVaultHandle({ owner });
  await handle.initialize({ passphrase: TEST_PASSPHRASE });
  await handle.unlockWithPassphrase({ passphrase: TEST_PASSPHRASE });
  return handle;
}

async function seedSyncedAddresses(handle: VaultHandle): Promise<void> {
  await handle.saveEncryptedData({
    type: VAULT_BLOB_FIELDS[VaultBlobType.Addresses],
    value: [{ id: '1', street: '123 Main St' }],
  });
  await handle.recordPushSuccess({
    type: VAULT_BLOB_FIELDS[VaultBlobType.Addresses],
    etag: 'etag-addresses-1',
  });
}

async function seedUnsentGroceriesAndTasks(handle: VaultHandle): Promise<void> {
  await handle.saveEncryptedData({
    type: VAULT_BLOB_FIELDS[VaultBlobType.Groceries],
    value: [{ id: 'g1', name: 'Milk' }],
  });
  await handle.saveEncryptedData({
    type: VAULT_BLOB_FIELDS[VaultBlobType.Tasks],
    value: [{ id: 't1', title: 'Task 1' }],
  });
}

describe('useUnsentVaultBlobTypes', () => {
  beforeEach(() => {
    // Clear Jest mocks
    jest.clearAllMocks();

    // Clear localStorage and sessionStorage to isolate each test
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Test 1: No session — hook returns pending when useOptionalVaultSession is null
  test('returns pending state when vaultSession is null', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useUnsentVaultBlobTypes(true));

    expect(result.current).toEqual({ status: 'pending', types: null });
  });

  // Test 2: Dialog closed — hasUnsentChanges is never called when active is false
  test('does not call hasUnsentChanges when dialog is closed (active=false)', async () => {
    const handle = await createUnlockedHandle();

    (useOptionalVaultSession as jest.Mock).mockReturnValue({ handle });

    const spy = jest.spyOn(handle, 'hasUnsentChanges');

    const { result } = renderHook(() => useUnsentVaultBlobTypes(false));

    // Immediately check state before any async work
    expect(result.current).toEqual({ status: 'pending', types: null });

    // Wait briefly to ensure no effect runs
    await waitFor(() => {
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // Test 3: Initial synchronous state — returns pending synchronously before effect runs
  test('returns pending state synchronously before async derivation', async () => {
    const handle = await createUnlockedHandle();

    (useOptionalVaultSession as jest.Mock).mockReturnValue({ handle });

    const { result } = renderHook(() => useUnsentVaultBlobTypes(true));

    // Synchronously, state is still pending — effect hasn't run yet
    expect(result.current).toEqual({ status: 'pending', types: null });

    // Allow the async effect to settle so setState doesn't land after test ends
    await waitFor(() => {
      expect(result.current.status).toBe('loaded');
    });
  });

  // Test 4: Fully synced — empty unsent types array when all data is pushed
  test('returns empty unsent types when all saved data has been pushed', async () => {
    const handle = await createUnlockedHandle();

    // Save and push Addresses and Tasks
    await seedSyncedAddresses(handle);

    await handle.saveEncryptedData({
      type: VAULT_BLOB_FIELDS[VaultBlobType.Tasks],
      value: [{ id: 't1', title: 'Task 1' }],
    });
    await handle.recordPushSuccess({
      type: VAULT_BLOB_FIELDS[VaultBlobType.Tasks],
      etag: 'etag-tasks-1',
    });

    (useOptionalVaultSession as jest.Mock).mockReturnValue({ handle });

    const { result } = renderHook(() => useUnsentVaultBlobTypes(true));

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'loaded', types: [] });
    });
  });

  // Test 5: Known subset unsent — correct types array with unsent changes
  test('returns correct unsent types in VAULT_BLOB_TYPES iteration order', async () => {
    const handle = await createUnlockedHandle();

    // Addresses: saved and pushed (synced)
    await seedSyncedAddresses(handle);

    // Groceries and Tasks: saved but NOT pushed (unsent)
    await seedUnsentGroceriesAndTasks(handle);

    // MobileNumbers, Subscriptions: not touched (no data)

    (useOptionalVaultSession as jest.Mock).mockReturnValue({ handle });

    const { result } = renderHook(() => useUnsentVaultBlobTypes(true));

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'loaded',
        types: [VaultBlobType.Groceries, VaultBlobType.Tasks],
      });
    });
  });

  // Test 6: Locked handle — correct unsent types even on a locked (never-unlocked) handle
  test('returns correct unsent types from a locked handle without Master Key', async () => {
    // Step 1: Build unsent state via unlocked handle
    const unlockedHandle = await createUnlockedHandle();

    // Addresses: saved and pushed
    await seedSyncedAddresses(unlockedHandle);

    // Groceries and Tasks: saved but NOT pushed
    await seedUnsentGroceriesAndTasks(unlockedHandle);

    // Step 2: Create a second, never-unlocked handle for the same owner
    const lockedHandle = createVaultHandle({ owner: TEST_OWNER });

    // Verify it's locked
    expect(lockedHandle.isUnlocked).toBe(false);

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: lockedHandle,
    });

    const { result } = renderHook(() => useUnsentVaultBlobTypes(true));

    // The locked handle should derive the same unsent types without unlocking
    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'loaded',
        types: [VaultBlobType.Groceries, VaultBlobType.Tasks],
      });
    });
  });

  // Test 7: Reopen recomputes — unsent types are recomputed on each dialog open
  test('recomputes unsent types each time dialog reopens, reflecting live Vault state', async () => {
    const handle = await createUnlockedHandle();

    (useOptionalVaultSession as jest.Mock).mockReturnValue({ handle });

    // Step 1: Render with active=true, all data synced → types: []
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useUnsentVaultBlobTypes(active),
      { initialProps: { active: true } },
    );

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'loaded', types: [] });
    });

    // Step 2: Save Tasks without pushing (creates unsent changes)
    await handle.saveEncryptedData({
      type: VAULT_BLOB_FIELDS[VaultBlobType.Tasks],
      value: [{ id: 't1', title: 'New Task' }],
    });

    // Step 3: Close dialog (rerender with active=false)
    rerender({ active: false });

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'pending', types: null });
    });

    // Step 4: Reopen dialog (rerender with active=true)
    rerender({ active: true });

    // After reopening, the hook should detect the new unsent changes
    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'loaded',
        types: [VaultBlobType.Tasks],
      });
    });
  });
});
