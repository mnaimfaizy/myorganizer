/* eslint-disable import/first -- jest.mock must precede application imports */
import { renderHook, waitFor } from '@testing-library/react';

jest.mock('@myorganizer/web-vault', () => ({
  ...jest.requireActual('@myorganizer/web-vault'),
  classifyVaultImportCredentialOutcome: jest.fn(),
  localToServerMeta: jest.fn(),
  parseVaultExportEnvelope: jest.fn(),
}));

jest.mock('@myorganizer/web-vault-ui', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import {
  classifyVaultImportCredentialOutcome,
  localToServerMeta,
  parseVaultExportEnvelope,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useVaultImportDisclosure } from './useVaultImportDisclosure';
import type { VaultMetaV1 } from '@myorganizer/app-api-client';

// === Mock helpers ===

function createMockFile(content: string): File & { text: jest.Mock } {
  const file = new File([content], 'vault.json', {
    type: 'application/json',
  });

  const mockText = jest.fn().mockResolvedValue(content);
  Object.defineProperty(file, 'text', {
    value: mockText,
    configurable: true,
  });

  return file as unknown as File & { text: jest.Mock };
}

function createMockServerMeta(
  overrides: Partial<VaultMetaV1> = {},
): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'salt-base',
    kdf_params: { hash: 'SHA-256', iterations: 310_000 },
    wrapped_mk_passphrase: {
      version: 1,
      iv: 'iv1-base',
      ciphertext: 'ct1-base',
    },
    wrapped_mk_recovery: {
      version: 1,
      iv: 'iv2-base',
      ciphertext: 'ct2-base',
    },
    ...overrides,
  };
}

describe('useVaultImportDisclosure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('B1: active false — stays pending, never reads the file', () => {
    test('when active=false and file is set, returns pending without reading file', async () => {
      const mockHandle = {
        loadVault: jest.fn(),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });

      const file = createMockFile('{"test": "content"}');

      const { result } = renderHook(() =>
        useVaultImportDisclosure(file, false),
      );

      expect(result.current).toEqual({
        status: 'pending',
        outcome: null,
      });

      // File should not have been read
      expect(file.text).not.toHaveBeenCalled();
      // Handle should not have loaded the vault
      expect(mockHandle.loadVault).not.toHaveBeenCalled();
    });
  });

  describe('B2: no file selected — stays pending', () => {
    test('when file=null and active=true, returns pending', async () => {
      const mockHandle = {
        loadVault: jest.fn(),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });

      const { result } = renderHook(() => useVaultImportDisclosure(null, true));

      expect(result.current).toEqual({
        status: 'pending',
        outcome: null,
      });

      expect(mockHandle.loadVault).not.toHaveBeenCalled();
    });
  });

  describe('B3: active + valid bundle matching local vault — resolves to unchanged', () => {
    test('initial render is pending, then resolves to loaded/unchanged', async () => {
      const localMeta = createMockServerMeta();
      const bundleMeta = createMockServerMeta();

      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (localToServerMeta as jest.Mock).mockReturnValue(localMeta);
      (parseVaultExportEnvelope as jest.Mock).mockReturnValue({
        meta: bundleMeta,
      });
      (classifyVaultImportCredentialOutcome as jest.Mock).mockReturnValue({
        kind: 'unchanged',
      });

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      // First render: should be pending
      expect(result.current.status).toBe('pending');
      expect(result.current.outcome).toBe(null);

      // After async work resolves
      await waitFor(() => {
        expect(result.current.status).toBe('loaded');
      });

      expect(result.current.outcome).toEqual({ kind: 'unchanged' });
    });
  });

  describe('B4: active + valid bundle from different Vault — resolves to different-vault', () => {
    test('resolves to loaded/different-vault when bundle is from different Vault', async () => {
      const localMeta = createMockServerMeta();
      const bundleMeta = createMockServerMeta({
        kdf_salt: 'salt-different',
      });

      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (localToServerMeta as jest.Mock).mockReturnValue(localMeta);
      (parseVaultExportEnvelope as jest.Mock).mockReturnValue({
        meta: bundleMeta,
      });
      (classifyVaultImportCredentialOutcome as jest.Mock).mockReturnValue({
        kind: 'different-vault',
      });

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      await waitFor(() => {
        expect(result.current.status).toBe('loaded');
      });

      expect(result.current.outcome).toEqual({ kind: 'different-vault' });
    });
  });

  describe('B5: file text is malformed JSON — resolves to unreadable', () => {
    test('when file.text() returns invalid JSON, resolves to unreadable', async () => {
      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (parseVaultExportEnvelope as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const file = createMockFile('not valid json {');

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      await waitFor(() => {
        expect(result.current.status).toBe('unreadable');
      });

      expect(result.current.outcome).toBe(null);
    });
  });

  describe('B6: file parses as JSON but fails envelope validation — resolves to unreadable', () => {
    test('when parseVaultExportEnvelope throws, resolves to unreadable', async () => {
      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (parseVaultExportEnvelope as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid envelope format');
      });

      const file = createMockFile('{"version": 1}');

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      await waitFor(() => {
        expect(result.current.status).toBe('unreadable');
      });

      expect(result.current.outcome).toBe(null);
    });
  });

  describe('B7: handle.loadVault() returns null — resolves to unreadable', () => {
    test('when handle.loadVault() returns null, resolves to unreadable', async () => {
      const mockHandle = {
        loadVault: jest.fn().mockReturnValue(null),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      await waitFor(() => {
        expect(result.current.status).toBe('unreadable');
      });

      expect(result.current.outcome).toBe(null);
    });
  });

  describe('B8: going from active back to inactive — returns to pending', () => {
    test('when active changes from true to false, returns to pending state', async () => {
      const localMeta = createMockServerMeta();
      const bundleMeta = createMockServerMeta();

      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (localToServerMeta as jest.Mock).mockReturnValue(localMeta);
      (parseVaultExportEnvelope as jest.Mock).mockReturnValue({
        meta: bundleMeta,
      });
      (classifyVaultImportCredentialOutcome as jest.Mock).mockReturnValue({
        kind: 'unchanged',
      });

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result, rerender } = renderHook(
        ({ active }) => useVaultImportDisclosure(file, active),
        { initialProps: { active: true } },
      );

      // Wait for first load
      await waitFor(() => {
        expect(result.current.status).toBe('loaded');
      });

      expect(result.current.outcome).toEqual({ kind: 'unchanged' });

      // Now switch to inactive
      rerender({ active: false });

      // Should return to pending
      expect(result.current.status).toBe('pending');
      expect(result.current.outcome).toBe(null);
    });
  });

  describe('Additional: wrapping-reverts cases', () => {
    test('resolves to loaded/wrapping-reverts for passphrase change', async () => {
      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (localToServerMeta as jest.Mock).mockReturnValue(createMockServerMeta());
      (parseVaultExportEnvelope as jest.Mock).mockReturnValue({
        meta: createMockServerMeta(),
      });
      (classifyVaultImportCredentialOutcome as jest.Mock).mockReturnValue({
        kind: 'wrapping-reverts',
        change: 'passphrase',
      });

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      await waitFor(() => {
        expect(result.current.status).toBe('loaded');
      });

      expect(result.current.outcome).toEqual({
        kind: 'wrapping-reverts',
        change: 'passphrase',
      });
    });

    test('resolves to loaded/wrapping-reverts for recovery-key change', async () => {
      const mockHandle = {
        loadVault: jest.fn().mockReturnValue({}),
      };
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: mockHandle,
      });
      (localToServerMeta as jest.Mock).mockReturnValue(createMockServerMeta());
      (parseVaultExportEnvelope as jest.Mock).mockReturnValue({
        meta: createMockServerMeta(),
      });
      (classifyVaultImportCredentialOutcome as jest.Mock).mockReturnValue({
        kind: 'wrapping-reverts',
        change: 'recovery-key',
      });

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      await waitFor(() => {
        expect(result.current.status).toBe('loaded');
      });

      expect(result.current.outcome).toEqual({
        kind: 'wrapping-reverts',
        change: 'recovery-key',
      });
    });
  });

  describe('Edge case: no vault session', () => {
    test('when useOptionalVaultSession returns null, stays pending', async () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

      const file = createMockFile(JSON.stringify({ data: 'test' }));

      const { result } = renderHook(() => useVaultImportDisclosure(file, true));

      expect(result.current).toEqual({
        status: 'pending',
        outcome: null,
      });

      // Should not attempt to load or parse anything
    });
  });
});
