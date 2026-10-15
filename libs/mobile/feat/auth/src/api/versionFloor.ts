// The Mobile App's side of the Version Floor (ADR 0114 decision 1, ADR 0117).
//
// Pure on purpose, like sessionRefresh.ts: no `react-native`, no module state.
// The native version, the platform and the store are handed in, so this
// project's Node-environment Jest suite drives it. `client.ts` is the wiring.
import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

/** The header the backend reads a Mobile Release's version from. */
export const CLIENT_HEADER = 'X-Client';

/** The status the backend refuses a Mobile Release below the floor with. */
const VERSION_FLOOR_REFUSAL_STATUS = 426;

const CLIENT_PLATFORMS: readonly string[] = ['android', 'ios'];

/**
 * The `X-Client` value for this build — `mobile/1.0.0 (android)` — or `null`
 * when it has none to send.
 *
 * `version` is the native build's own, the version of the `mobile-vX.Y.Z`
 * GitHub Release it was downloaded from; it is not repeated in JavaScript.
 * The web preview has no native build, so it sends no header and is treated
 * as the web app is. Neither does a native build that cannot read its version
 * — which passes the floor unchecked, but cannot happen in practice: the
 * version comes from RNAppInfo, compiled into the app itself. Sending a guess
 * instead would refuse the build whenever a floor is set.
 *
 * Only Android ships Mobile Releases (ADR 0127). An iOS development build
 * names itself too, so the backend sees the same header on both.
 */
export function buildClientHeader(
  version: string | null,
  platform: string,
): string | null {
  if (!version || !CLIENT_PLATFORMS.includes(platform)) return null;
  return `mobile/${version} (${platform})`;
}

/** True when `error` is the backend refusing this build as below the floor. */
export function isVersionFloorRefusal(error: unknown): boolean {
  const status = (error as { response?: { status?: unknown } } | null)?.response
    ?.status;
  return status === VERSION_FLOOR_REFUSAL_STATUS;
}

/**
 * That this build was refused. Once it is set it stays set: the only way past
 * it is installing a newer Mobile Release, which starts a new process.
 *
 * `unsavedChange` — a Vault Push was refused, so the last change the User made
 * was not saved (ADR 0117). Nothing keeps that change across the update.
 */
export interface VersionFloorRefusal {
  unsavedChange: boolean;
}

export interface VersionFloorStore {
  get: () => VersionFloorRefusal | null;
  subscribe: (listener: () => void) => () => void;
  /** Records a refusal; `unsavedChange`, once reported, is never cleared. */
  report: (refusal?: Partial<VersionFloorRefusal>) => void;
}

export function createVersionFloorStore(): VersionFloorStore {
  let current: VersionFloorRefusal | null = null;
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    report: (refusal) => {
      const unsavedChange =
        (current?.unsavedChange ?? false) || refusal?.unsavedChange === true;
      if (current !== null && current.unsavedChange === unsavedChange) return;
      current = { unsavedChange };
      for (const listener of listeners) listener();
    },
  };
}

/**
 * Sends `clientHeader` on every request `client` makes, and reports a 426
 * from any of them to `onRefused`.
 *
 * The one place a refusal is handled. The refusal still rejects: the
 * caller's request failed and must not be reported as a success. It does not
 * depend on where `installRefreshOn401` sits: that interceptor acts on a 401
 * alone and passes a 426 through untouched, so a refusal never starts a
 * refresh, and a request it replays after a refresh comes back through here.
 */
export function installVersionFloor(
  client: AxiosInstance,
  params: { clientHeader: string | null; onRefused: () => void },
): void {
  const { clientHeader, onRefused } = params;
  if (clientHeader !== null) {
    client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      config.headers[CLIENT_HEADER] = clientHeader;
      return config;
    });
  }
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (isVersionFloorRefusal(error)) onRefused();
      return Promise.reject(error);
    },
  );
}

/**
 * Records a write that `error` stopped. A Version Floor refusal is a failed
 * Vault Push (ADR 0117): the edit is already reverted and unsaved, and
 * Update required says so. Any other failure is left to the screen.
 */
export function reportRefusedWrite(
  store: VersionFloorStore,
  error: unknown,
): void {
  if (isVersionFloorRefusal(error)) store.report({ unsavedChange: true });
}
