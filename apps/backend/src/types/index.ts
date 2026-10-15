export type UserRole = 'user' | 'platform_admin';

export interface LoginTokensInterface {
  token: string | Error;
  refreshToken: string | Error;
}

export interface UserInterface {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email: string;
  password: string;
  email_verified_at?: Date;
  email_verification_timestamp?: Date | null;
  password_reset_token: string | null;
  blacklisted_tokens?: Array<string>;
  role?: UserRole;
  disabled?: boolean;
  /** Whether a Platform Admin currently grants YouTube Access (ADR 0129). */
  youtube_access?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FilteredUserInterface {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  disabled: boolean;
}

/** Identity-only User projection for Platform Admin directory APIs. */
export interface AdminUserIdentity {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  disabled: boolean;
  emailVerified: boolean;
  /** Whether a Platform Admin currently grants this User YouTube Access (ADR 0129). */
  youtubeAccess: boolean;
}

/** Outcome of the YouTube Disconnect that a withdrawal triggers (ADR 0129). */
export type YouTubeDisconnectOutcome =
  | 'completed'
  | 'pending'
  | 'not_connected';

/** Identity after a YouTube Access withdrawal, with the disconnect outcome. */
export type WithdrawYouTubeAccessResponse = AdminUserIdentity & {
  youtubeDisconnect: YouTubeDisconnectOutcome;
};

export type AdminAuditAction =
  | 'disable'
  | 'enable'
  | 'force_logout'
  | 'resend_verification'
  | 'promote'
  | 'demote'
  | 'youtube_access_grant'
  | 'youtube_access_withdraw';

/** Platform Admin Audit Log entry returned by list APIs. */
export interface AdminAuditLogEntry {
  id: string;
  actorUserId: string;
  targetUserId: string;
  action: AdminAuditAction;
  createdAt: Date;
}

export class MyError extends Error {
  public statusCode;
  public data;
  public title: string;

  constructor(title: string, statusCode: number, data?: object) {
    super(title);
    Object.setPrototypeOf(this, MyError.prototype);
    this.statusCode = statusCode;
    this.data = data;
    this.title = title;
  }
}
