// Pure Axios-error inspection helpers for this project's login/unlock error
// classification. This project's Jest config runs in a plain Node
// environment (no React Native preset), so these stay free of any import
// that would pull in `react-native` or `react-native-quick-crypto` — which
// is also why this does not simply import `isNetworkError` from
// `@myorganizer/mobile/feat-vault`: that package's entry point re-exports
// `crypto.ts`, and `crypto.ts` imports `react-native-quick-crypto`, which
// cannot load outside a React Native runtime.

/**
 * True when a request never got an answer from the server — the device is
 * offline or the host is unreachable — as against the server answering with
 * an error.
 */
export function isNetworkError(err: unknown): boolean {
  const e = err as {
    response?: unknown;
    isAxiosError?: boolean;
    code?: string;
  };
  return (
    !e?.response && (e?.isAxiosError === true || e?.code === 'ERR_NETWORK')
  );
}

/** Reads the backend's own `{ message }` shape off an Axios error response. */
export function extractServerMessage(err: unknown): string | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  const message = (data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' ? message : null;
}

/** Reads an HTTP status code off an Axios-shaped error, if present. */
export function httpStatus(err: unknown): number | undefined {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof status === 'number' ? status : undefined;
}
