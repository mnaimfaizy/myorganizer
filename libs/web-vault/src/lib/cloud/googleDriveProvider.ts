import {
  GisTokenClient,
  GisTokenResponse,
  GoogleNamespace,
} from './googleIdentity.types';
import {
  CloudBackupConnectionState,
  CloudBackupFileMetadata,
  CloudBackupProvider,
  UploadBackupInput,
  UploadBackupResult,
} from './types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const APP_PROPERTY_KIND = 'kind';
const APP_PROPERTY_KIND_VALUE = 'myorganizer-vault-backup';
const APP_PROPERTY_STATUS = 'status';
const APP_PROPERTY_EXPORT_ID = 'exportId';
const APP_PROPERTY_SCHEMA_VERSION = 'schemaVersion';
const CONNECTED_FLAG_KEY = 'myorganizer.cloudBackup.googleDrive.connected';

export interface GoogleDriveProviderOptions {
  /**
   * Google OAuth Client ID. Required when running in the browser.
   */
  clientId: string;
  /**
   * Optional override for the global `google` namespace, useful for tests.
   */
  google?: GoogleNamespace | (() => GoogleNamespace | undefined);
  /**
   * Optional override for `fetch`, useful for tests.
   */
  fetchImpl?: typeof fetch;
  /**
   * Skew applied when deciding if a cached token is still usable. Default 60s.
   */
  tokenSkewMs?: number;
}

interface AccessToken {
  token: string;
  expiresAtMs: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveGoogle(
  override: GoogleDriveProviderOptions['google'],
): GoogleNamespace | undefined {
  if (typeof override === 'function') return override();
  if (override) return override;
  if (typeof window !== 'undefined') return window.google;
  return undefined;
}

function readConnectedFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONNECTED_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function writeConnectedFlag(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(CONNECTED_FLAG_KEY, '1');
    } else {
      window.localStorage.removeItem(CONNECTED_FLAG_KEY);
    }
  } catch {
    // ignore quota or access errors
  }
}

function parseDriveFile(raw: unknown): CloudBackupFileMetadata | null {
  if (!isPlainObject(raw)) return null;
  const id = raw.id;
  const name = raw.name;
  const createdTime = raw.createdTime ?? raw.modifiedTime;
  const sizeBytes = raw.size;
  const props = raw.appProperties;
  if (typeof id !== 'string') return null;
  if (typeof name !== 'string') return null;
  if (typeof createdTime !== 'string') return null;

  let exportId = '';
  let schemaVersion = 1;
  let status: CloudBackupFileMetadata['status'] = 'pending';
  if (isPlainObject(props)) {
    if (typeof props[APP_PROPERTY_EXPORT_ID] === 'string') {
      exportId = props[APP_PROPERTY_EXPORT_ID] as string;
    }
    const schemaRaw = props[APP_PROPERTY_SCHEMA_VERSION];
    if (typeof schemaRaw === 'string') {
      const parsed = Number.parseInt(schemaRaw, 10);
      if (Number.isFinite(parsed)) schemaVersion = parsed;
    } else if (typeof schemaRaw === 'number') {
      schemaVersion = schemaRaw;
    }
    const statusRaw = props[APP_PROPERTY_STATUS];
    if (statusRaw === 'complete' || statusRaw === 'pending') {
      status = statusRaw;
    }
  }

  let parsedSize = 0;
  if (typeof sizeBytes === 'string') {
    const n = Number.parseInt(sizeBytes, 10);
    if (Number.isFinite(n)) parsedSize = n;
  } else if (typeof sizeBytes === 'number') {
    parsedSize = sizeBytes;
  }

  return {
    id,
    name,
    createdAt: createdTime,
    exportId,
    schemaVersion,
    status,
    sizeBytes: parsedSize,
  };
}

export class GoogleDriveCloudBackupProvider implements CloudBackupProvider {
  readonly id = 'google-drive' as const;

  private readonly clientId: string;
  private readonly googleOverride: GoogleDriveProviderOptions['google'];
  private readonly fetchImpl: typeof fetch;
  private readonly tokenSkewMs: number;

  private tokenClient: GisTokenClient | null = null;
  private currentToken: AccessToken | null = null;
  private connected = false;
  private needsReconnect = false;

  constructor(options: GoogleDriveProviderOptions) {
    this.clientId = options.clientId;
    this.googleOverride = options.google;
    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : ((() => {
            throw new Error('fetch is not available in this environment');
          }) as typeof fetch));
    this.tokenSkewMs = options.tokenSkewMs ?? 60_000;
  }

  async getConnectionState(): Promise<CloudBackupConnectionState> {
    // We do NOT eagerly re-acquire a token here, because the GIS implicit
    // token flow always tries to open a popup window. Browsers block popups
    // that aren't tied to a user gesture, so calling this on page load
    // produces a "Failed to open popup" warning. Instead, treat the
    // localStorage "connected" flag as optimistic state; the next user
    // gesture (backup/restore) will lazily re-acquire the token.
    if (this.needsReconnect) {
      return { status: 'needs-reconnect' };
    }
    if (this.connected && this.currentToken) {
      return { status: 'connected' };
    }
    if (readConnectedFlag()) {
      // Show "Connected" optimistically; actions will refresh state if the
      // token cannot be silently re-acquired.
      return { status: 'connected' };
    }
    return { status: 'disconnected' };
  }

  async connect(): Promise<CloudBackupConnectionState> {
    await this.acquireToken({ interactive: true });
    this.connected = true;
    this.needsReconnect = false;
    writeConnectedFlag(true);
    return { status: 'connected' };
  }

  async disconnect(): Promise<void> {
    const token = this.currentToken?.token;
    const google = resolveGoogle(this.googleOverride);
    if (token && google?.accounts?.oauth2?.revoke) {
      await new Promise<void>((resolve) => {
        try {
          google.accounts.oauth2.revoke(token, () => resolve());
        } catch {
          resolve();
        }
      });
    }
    this.currentToken = null;
    this.tokenClient = null;
    this.connected = false;
    this.needsReconnect = false;
    writeConnectedFlag(false);
  }

  /**
   * Returns true when a valid access token is available without prompting.
   * Used by the scheduler.
   */
  async canRunSilently(): Promise<boolean> {
    try {
      await this.acquireToken({ interactive: false });
      return true;
    } catch {
      this.needsReconnect = true;
      this.connected = false;
      return false;
    }
  }

  async uploadBackup(input: UploadBackupInput): Promise<UploadBackupResult> {
    const token = await this.acquireToken({ interactive: false });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}_${input.exportId}.json`;

    const created = await this.driveJson(token, '/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        parents: ['appDataFolder'],
        appProperties: {
          [APP_PROPERTY_KIND]: APP_PROPERTY_KIND_VALUE,
          [APP_PROPERTY_STATUS]: 'pending',
          [APP_PROPERTY_EXPORT_ID]: input.exportId,
          [APP_PROPERTY_SCHEMA_VERSION]: String(input.schemaVersion),
        },
      }),
    });
    const fileId = (created as { id?: string }).id;
    if (!fileId) throw new Error('Drive create did not return file id');

    // Phase 2: upload the JSON content via media upload.
    await this.driveText(
      token,
      `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(fileId)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: input.text,
      },
    );

    // Phase 3: finalize metadata to status=complete and fetch authoritative
    // file metadata for the result.
    const finalized = await this.driveJson(
      token,
      `/files/${encodeURIComponent(fileId)}?fields=id,name,createdTime,modifiedTime,size,appProperties`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appProperties: {
            [APP_PROPERTY_KIND]: APP_PROPERTY_KIND_VALUE,
            [APP_PROPERTY_STATUS]: 'complete',
            [APP_PROPERTY_EXPORT_ID]: input.exportId,
            [APP_PROPERTY_SCHEMA_VERSION]: String(input.schemaVersion),
          },
        }),
      },
    );

    const metadata = parseDriveFile(finalized);
    if (!metadata) {
      throw new Error('Drive returned malformed file metadata');
    }
    return { fileId, metadata };
  }

  async downloadLatestBackup(): Promise<{
    text: string;
    metadata: CloudBackupFileMetadata;
  } | null> {
    const token = await this.acquireToken({ interactive: false });
    const list = await this.listBackupFiles(token);
    const completed = list
      .filter((f) => f.status === 'complete')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = completed[0];
    if (!latest) return null;

    const text = await this.driveText(
      token,
      `${DRIVE_API_BASE}/files/${encodeURIComponent(latest.id)}?alt=media`,
      { method: 'GET' },
    );
    return { text, metadata: latest };
  }

  async pruneBackups(options: {
    keepCount: number;
    stalePendingMs: number;
  }): Promise<{ deletedCompleted: number; deletedPending: number }> {
    const token = await this.acquireToken({ interactive: false });
    const list = await this.listBackupFiles(token);
    const now = Date.now();

    const completed = list
      .filter((f) => f.status === 'complete')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const stalePending = list.filter((f) => {
      if (f.status !== 'pending') return false;
      const created = Date.parse(f.createdAt);
      if (!Number.isFinite(created)) return false;
      return now - created >= options.stalePendingMs;
    });

    const toDeleteCompleted = completed.slice(options.keepCount);
    let deletedCompleted = 0;
    for (const file of toDeleteCompleted) {
      await this.deleteFile(token, file.id);
      deletedCompleted += 1;
    }
    let deletedPending = 0;
    for (const file of stalePending) {
      await this.deleteFile(token, file.id);
      deletedPending += 1;
    }
    return { deletedCompleted, deletedPending };
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private async acquireToken(opts: { interactive: boolean }): Promise<string> {
    const cached = this.currentToken;
    if (cached && cached.expiresAtMs - this.tokenSkewMs > Date.now()) {
      return cached.token;
    }

    const google = resolveGoogle(this.googleOverride);
    if (!google?.accounts?.oauth2?.initTokenClient) {
      throw new Error('Google Identity Services is not available');
    }

    return await new Promise<string>((resolve, reject) => {
      const settle = (resp: GisTokenResponse) => {
        if (resp.error || !resp.access_token) {
          this.needsReconnect = true;
          reject(
            new Error(
              resp.error_description ?? resp.error ?? 'token-acquire-failed',
            ),
          );
          return;
        }
        const expiresInMs = (resp.expires_in ?? 3600) * 1000;
        this.currentToken = {
          token: resp.access_token,
          expiresAtMs: Date.now() + expiresInMs,
        };
        this.connected = true;
        this.needsReconnect = false;
        resolve(resp.access_token);
      };

      try {
        if (!this.tokenClient) {
          this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: DRIVE_APPDATA_SCOPE,
            callback: settle,
          });
        } else {
          this.tokenClient.callback = settle;
        }
        const prompt = opts.interactive ? 'consent' : '';
        this.tokenClient.requestAccessToken({ prompt });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private async listBackupFiles(
    token: string,
  ): Promise<CloudBackupFileMetadata[]> {
    const q = encodeURIComponent(
      `appProperties has { key='${APP_PROPERTY_KIND}' and value='${APP_PROPERTY_KIND_VALUE}' }`,
    );
    const url =
      `/files?spaces=appDataFolder&q=${q}` +
      `&fields=files(id,name,createdTime,modifiedTime,size,appProperties)` +
      `&pageSize=100&orderBy=createdTime desc`;
    const json = await this.driveJson(token, url, { method: 'GET' });
    const files = (json as { files?: unknown[] }).files ?? [];
    const out: CloudBackupFileMetadata[] = [];
    for (const f of files) {
      const parsed = parseDriveFile(f);
      if (parsed) out.push(parsed);
    }
    return out;
  }

  private async deleteFile(token: string, fileId: string): Promise<void> {
    await this.fetchImpl(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  private async driveJson(
    token: string,
    pathOrUrl: string,
    init: RequestInit,
  ): Promise<unknown> {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${DRIVE_API_BASE}${pathOrUrl}`;
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    const res = await this.fetchImpl(url, { ...init, headers });
    if (!res.ok) {
      throw new Error(await formatDriveError(res));
    }
    if (res.status === 204) return {};
    return await res.json();
  }

  private async driveText(
    token: string,
    pathOrUrl: string,
    init: RequestInit,
  ): Promise<string> {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${DRIVE_API_BASE}${pathOrUrl}`;
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    const res = await this.fetchImpl(url, { ...init, headers });
    if (!res.ok) {
      throw new Error(await formatDriveError(res));
    }
    return await res.text();
  }
}

async function formatDriveError(res: Response): Promise<string> {
  let detail = '';
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as {
          error?: { message?: string; status?: string };
        };
        const msg = parsed.error?.message;
        if (msg) detail = `: ${msg}`;
        else detail = `: ${text.slice(0, 300)}`;
      } catch {
        detail = `: ${text.slice(0, 300)}`;
      }
    }
  } catch {
    // ignore body read errors
  }
  return `Drive request failed: ${res.status} ${res.statusText}${detail}`;
}
