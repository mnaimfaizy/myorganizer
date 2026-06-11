import type {
  Login200Response,
  FilteredUserInterface,
} from '@myorganizer/app-api-client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  user: FilteredUserInterface;
  tokens: AuthTokens;
}

export type { Login200Response, FilteredUserInterface };
