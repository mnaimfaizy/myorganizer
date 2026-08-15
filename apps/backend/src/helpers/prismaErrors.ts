/**
 * Prisma surfaces constraint failures as error codes rather than typed errors.
 * P2002 is the unique-constraint violation, which the digest ledger and the
 * worker leases both rely on as their concurrency guard rather than treating
 * it as a fault.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
