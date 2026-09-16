import {
  GisErrorResponse,
  GisTokenClient,
  GisTokenResponse,
  GoogleNamespace,
} from './googleIdentity.types';
import { CloudBackupPromptError } from './promptError';
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
// The stored value keeps its historical key so existing links survive; it
// records that the User completed a connection (Linked), nothing more.
const LINKED_FLAG_KEY = 'myorganizer.cloudBackup.googleDrive.connected';
// Recorded because it cost an attempt to learn (CONTEXT.md: Linked Provider).
const RECONNECT_NEEDED_FLAG_KEY =
  'myorganizer.cloudBackup.googleDrive.reconnectNeeded';

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

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore quota or access errors
  }
}

const GIS_PROMPT_FAILURES: Record<
  'popup_failed_to_open' | 'popup_closed',
  'popup-blocked' | 'popup-closed'
> = {
  popup_failed_to_open: 'popup-blocked',
  popup_closed: 'popup-closed',
};

function toPromptError(err: GisErrorResponse): CloudBackupPromptError {
  const failure =
    err.type === 'popup_failed_to_open' || err.type === 'popup_closed'
      ? GIS_PROMPT_FAILURES[err.type]
      : 'unknown';
  return new CloudBackupPromptError(failure, err.message);
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
  /** Settlers for the token request in flight; GIS callbacks dispatch here. */
  private pendingToken: {
    resolve: (resp: GisTokenResponse) => void;
    reject: (err: CloudBackupPromptError) => void;
  } | null = null;

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
    // Never tries to obtain a token: the GIS implicit flow always opens a
    // popup, and whether a token can be had is only discovered by trying
    // from a user gesture. The state reports what is recorded, nothing more.
    if (!readFlag(LINKED_FLAG_KEY)) {
      return { status: 'not-linked' };
    }
    if (readFlag(RECONNECT_NEEDED_FLAG_KEY)) {
      return { status: 'reconnect-needed' };
    }
    return { status: 'linked' };
  }

  async connect(): Promise<CloudBackupConnectionState> {
    await this.acquireToken({ interactive: true });
    writeFlag(LINKED_FLAG_KEY, true);
    return { status: 'linked' };
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
    writeFlag(LINKED_FLAG_KEY, false);
    writeFlag(RECONNECT_NEEDED_FLAG_KEY, false);
  }

  /**
   * True when this instance already holds an unexpired access token, so a
   * backup can run with nobody present. Never requests one: a request outside
   * a user gesture opens a popup the browser blocks.
   */
  canRunWithoutPrompt(): boolean {
    return this.holdsUsableToken();
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

  private holdsUsableToken(): boolean {
    const cached = this.currentToken;
    return (
      cached !== null && cached.expiresAtMs - this.tokenSkewMs > Date.now()
    );
  }

  /**
   * Obtain an access token, from memory when one is held, otherwise from GIS.
   *
   * Three outcomes, each recorded differently (CONTEXT.md: Linked Provider):
   * - a token — Reconnect Needed, if recorded, is cleared;
   * - a refusal Google returned through `callback` — evidence against the
   *   link, recorded as Reconnect Needed when a link exists (a connection
   *   never completed is not Linked, so it cannot need reconnecting);
   * - a `CloudBackupPromptError` through `error_callback` — the attempt never
   *   reached Google and records nothing.
   */
  private async acquireToken(opts: { interactive: boolean }): Promise<string> {
    if (this.holdsUsableToken() && this.currentToken) {
      return this.currentToken.token;
    }

    const google = resolveGoogle(this.googleOverride);
    if (!google?.accounts?.oauth2?.initTokenClient) {
      throw new Error('Google Identity Services is not available');
    }

    // A request superseded by a newer one will never be answered; settle it
    // rather than leave its caller waiting forever.
    this.pendingToken?.reject(
      new CloudBackupPromptError('unknown', 'Superseded by a newer request'),
    );

    const resp = await new Promise<GisTokenResponse>((resolve, reject) => {
      this.pendingToken = { resolve, reject };
      try {
        if (!this.tokenClient) {
          this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: DRIVE_APPDATA_SCOPE,
            callback: (answer) => this.settleToken(answer),
            error_callback: (err) => this.failToken(err),
          });
        }
        const prompt = opts.interactive ? 'consent' : '';
        this.tokenClient.requestAccessToken({ prompt });
      } catch (err) {
        this.pendingToken = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    if (resp.error || !resp.access_token) {
      if (readFlag(LINKED_FLAG_KEY)) {
        writeFlag(RECONNECT_NEEDED_FLAG_KEY, true);
      }
      throw new Error(
        resp.error_description ?? resp.error ?? 'token-acquire-failed',
      );
    }

    const expiresInMs = (resp.expires_in ?? 3600) * 1000;
    this.currentToken = {
      token: resp.access_token,
      expiresAtMs: Date.now() + expiresInMs,
    };
    writeFlag(RECONNECT_NEEDED_FLAG_KEY, false);
    return resp.access_token;
  }

  private settleToken(answer: GisTokenResponse): void {
    const pending = this.pendingToken;
    this.pendingToken = null;
    pending?.resolve(answer);
  }

  private failToken(err: GisErrorResponse): void {
    const pending = this.pendingToken;
    this.pendingToken = null;
    pending?.reject(toPromptError(err));
  }

  /**
   * A 401 on a token this instance believed unexpired means Google no longer
   * honours it. Drop it so the next attempt asks Google, whose answer is the
   * one that decides whether the link needs reconnecting.
   */
  private async failDriveRequest(res: Response): Promise<never> {
    if (res.status === 401) this.currentToken = null;
    throw new Error(await formatDriveError(res));
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
      return await this.failDriveRequest(res);
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
      return await this.failDriveRequest(res);
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
