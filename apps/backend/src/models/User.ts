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

export interface UserLoginBody {
  email: string;
  password: string;
}

export interface ConfirmResetPasswordBody {
  token: string;
  password: string;
  confirm_password: string;
}
