/**
 * True when a request never got an answer from the server — the device is
 * offline or the host is unreachable — as against the server answering with
 * an error, or the answer failing to decrypt.
 *
 * Split out of `sync.ts` so a caller outside the Vault feature (an entry
 * screen's login/unlock error classification) can import this one pure check
 * without pulling in `crypto.ts`'s `react-native-quick-crypto` dependency —
 * the same reason `bytes.ts` exists apart from `crypto.ts`.
 */
export function isNetworkError(error: unknown): boolean {
  const e = error as {
    response?: unknown;
    isAxiosError?: boolean;
    code?: string;
  };
  return (
    !e?.response && (e?.isAxiosError === true || e?.code === 'ERR_NETWORK')
  );
}
