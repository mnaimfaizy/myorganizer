export interface User {
  id: string;
  name?: string;
  email: string;
  password?: string;
  reset_password_token?: string;
  email_verification_timestamp?: Date;
  blacklisted_tokens?: string[];
}

export interface UserCreationBody {
  name?: string;
  email: string;
  password: string;
}
