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
}

export class MyError extends Error {
  public statusCode;
  public data;
  public title: string;

  constructor(title: string, statusCode: number, data?: object) {
    super(title);
    Object.setPrototypeOf(this, MyError);
    this.statusCode = statusCode;
    this.data = data;
    this.title = title;
  }
}
