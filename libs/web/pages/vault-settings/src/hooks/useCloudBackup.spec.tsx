import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';

import { useCloudBackup } from './useCloudBackup';

import type {
  CloudBackupConnectionState,
  CloudBackupProvider,
  UploadBackupInput,
  UploadBackupResult,
} from '@myorganizer/web-vault';

// Minimal in-memory localStorage so the preferences module works under
// the (no jsdom) Jest preset used by this page library.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(_index: number): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

function installWindowShim() {
  const w = (globalThis as { window?: { localStorage: MemoryStorage } }).window;
  if (!w) {
    (globalThis as { window: { localStorage: MemoryStorage } }).window = {
      localStorage: new MemoryStorage(),
    };
  } else {
    w.localStorage = new MemoryStorage();
  }
}

function makeFakeProvider(
  initial: CloudBackupConnectionState = { status: 'disconnected' },
): CloudBackupProvider & {
  setNextConnect(state: CloudBackupConnectionState): void;
  setConnectError(err: Error): void;
} {
  let state = initial;
  let nextConnect: CloudBackupConnectionState | null = null;
  let connectError: Error | null = null;
  const provider = {
    id: 'google-drive' as const,
    async getConnectionState() {
      return state;
    },
    async connect() {
      if (connectError) {
        const err = connectError;
        connectError = null;
        throw err;
      }
      state = nextConnect ?? { status: 'connected' };
      return state;
    },
    async disconnect() {
      state = { status: 'disconnected' };
    },
    async uploadBackup(_input: UploadBackupInput): Promise<UploadBackupResult> {
      return {
        fileId: 'noop',
        metadata: {
          id: 'noop',
          name: 'noop',
          createdAt: new Date().toISOString(),
          exportId: 'noop',
          schemaVersion: 1,
          status: 'complete',
          sizeBytes: 0,
        },
      };
    },
    async downloadLatestBackup() {
      return null;
    },
    async pruneBackups() {
      return { deletedCompleted: 0, deletedPending: 0 };
    },
    setNextConnect(s: CloudBackupConnectionState) {
      nextConnect = s;
    },
    setConnectError(err: Error) {
      connectError = err;
    },
  };
  return provider;
}

function HookProbe({
  provider,
  onState,
}: {
  provider: CloudBackupProvider;
  onState: (s: ReturnType<typeof useCloudBackup>) => void;
}) {
  const result = useCloudBackup({ providerId: 'google-drive', provider });
  useEffect(() => {
    onState(result);
  });
  return (
    <div>
      <span data-testid="conn">{result.connection.status}</span>
      <span data-testid="interval">{result.autoInterval}</span>
      <span data-testid="busy">{result.isBusy ? 'yes' : 'no'}</span>
      <span data-testid="err">{result.lastError ?? ''}</span>
    </div>
  );
}

describe('useCloudBackup', () => {
  beforeEach(() => {
    installWindowShim();
  });

  test('reflects initial provider connection state', async () => {
    const provider = makeFakeProvider({ status: 'connected' });
    let last: ReturnType<typeof useCloudBackup> | null = null;
    await act(async () => {
      render(<HookProbe provider={provider} onState={(s) => (last = s)} />);
    });
    expect(screen.getByTestId('conn').textContent).toBe('connected');
    expect(last?.autoInterval).toBe('off');
  });

  test('connect updates connection and clears errors on success', async () => {
    const provider = makeFakeProvider();
    provider.setNextConnect({ status: 'connected' });
    let last: ReturnType<typeof useCloudBackup> | null = null;
    await act(async () => {
      render(<HookProbe provider={provider} onState={(s) => (last = s)} />);
    });

    await act(async () => {
      await last!.connect();
    });
    expect(screen.getByTestId('conn').textContent).toBe('connected');
    expect(screen.getByTestId('err').textContent).toBe('');
  });

  test('connect failure surfaces lastError and keeps connection unchanged', async () => {
    const provider = makeFakeProvider();
    provider.setConnectError(new Error('consent denied'));
    let last: ReturnType<typeof useCloudBackup> | null = null;
    await act(async () => {
      render(<HookProbe provider={provider} onState={(s) => (last = s)} />);
    });

    await act(async () => {
      await expect(last!.connect()).rejects.toThrow('consent denied');
    });
    expect(screen.getByTestId('err').textContent).toBe('consent denied');
  });

  test('setAutoInterval persists to local storage and re-loads on next mount', async () => {
    const provider = makeFakeProvider();
    let last: ReturnType<typeof useCloudBackup> | null = null;

    const { unmount } = render(
      <HookProbe provider={provider} onState={(s) => (last = s)} />,
    );
    await act(async () => undefined);

    act(() => {
      last!.setAutoInterval('weekly');
    });
    expect(screen.getByTestId('interval').textContent).toBe('weekly');

    unmount();

    await act(async () => {
      render(<HookProbe provider={provider} onState={(s) => (last = s)} />);
    });
    expect(screen.getByTestId('interval').textContent).toBe('weekly');
  });

  test("setAutoInterval('off') clears persisted preference", async () => {
    const provider = makeFakeProvider();
    let last: ReturnType<typeof useCloudBackup> | null = null;

    const first = render(
      <HookProbe provider={provider} onState={(s) => (last = s)} />,
    );
    await act(async () => undefined);
    act(() => {
      last!.setAutoInterval('daily');
    });
    expect(screen.getByTestId('interval').textContent).toBe('daily');
    first.unmount();
    act(() => {
      last!.setAutoInterval('off');
    });

    await act(async () => {
      render(<HookProbe provider={provider} onState={(s) => (last = s)} />);
    });
    expect(screen.getByTestId('interval').textContent).toBe('off');
  });
});
