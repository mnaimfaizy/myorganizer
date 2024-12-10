export interface LoginTokensInterface {
  token: string | Error;
  refreshToken: string | Error;
}

export interface UserInterface {
  id: string;
  name: string;
  email: string;
  password: string;
  email_verified_at?: Date;
  password_reset_token: string | null;
  blacklisted_tokens?: Array<string>;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<UserInterface>;
}

export interface FilteredUserInterface {
  id: string;
  name: string;
  email: string;
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
