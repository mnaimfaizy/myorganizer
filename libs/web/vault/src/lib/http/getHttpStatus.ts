export function getHttpStatus(error: unknown): number | undefined {
  const maybeAny = error as any;
  const status = maybeAny?.response?.status;
  return typeof status === 'number' ? status : undefined;
}
