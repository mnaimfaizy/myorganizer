/**
 * Shared data-privacy bullets for the YouTube connect prompt and the
 * connected SubscriptionManager summary. One source so disconnect wording
 * (Watched Ledger retention) cannot drift between the two surfaces.
 */
export const YOUTUBE_DATA_PRIVACY_BULLETS = [
  'Metadata only — never video files',
  'Watched is yes/no, not analytics',
  'Latest 100 uploads cached per channel',
  '30 days after you disable a channel',
  'Disconnect removes Followed Channels, Cached Uploads, digest settings, and tokens; Watched is kept for 30 days unless you choose to delete it',
  'Shorts budget is tracked locally',
] as const;
