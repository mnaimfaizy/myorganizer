import { FilteredUserInterface } from '../types';

export interface RegisterUserResponse {
  message: string;
  user?: FilteredUserInterface;
}

/** Refresh Token presented in a JSON body (mobile). Cookie remains the web channel. */
export interface RefreshTokenBody {
  refresh_token?: string;
}
