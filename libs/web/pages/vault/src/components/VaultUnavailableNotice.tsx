interface VaultUnavailableNoticeProps {
  /**
   * The one sentence from the Vault operation policy saying why the operation
   * is unavailable, or `null` when it is allowed — in which case the component
   * renders nothing, so a card never has to guard the call itself.
   */
  reason: string | null;
  /** `data-testid` for this card's notice. */
  testId: string;
}

/**
 * Renders a reason paragraph for a vault card when the operation is unavailable.
 * Returns null when the operation is allowed, so callers don't need a guard.
 */
export function VaultUnavailableNotice({
  reason,
  testId,
}: VaultUnavailableNoticeProps) {
  if (!reason) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground" data-testid={testId}>
      {reason}
    </p>
  );
}
