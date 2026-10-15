/**
 * Shared data-privacy bullets for the YouTube connect prompt and the
 * connected SubscriptionManager summary. One source so disconnect wording
 * (what Disconnect deletes, immediately and with no retention) cannot drift
 * between the two surfaces.
 */
export const YOUTUBE_DATA_PRIVACY_BULLETS = [
  'Metadata only — never video files',
  'Watched is yes/no, not analytics',
  'Latest 100 uploads cached per channel',
  '30 days after you disable a channel',
  'Disconnect deletes Followed Channels, Cached Uploads, Watched marks, notification and digest settings, and tokens',
  'Shorts budget is tracked locally',
] as const;
