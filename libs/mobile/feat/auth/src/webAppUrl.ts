import { MOBILE_ENVIRONMENT } from '@myorganizer/mobile/core';

// Web app creation (sign-up, Vault creation) and finishing a password reset
// both stay on the web — this is where a mobile screen sends the User to do
// either. The environment module decides which web app that is.
export const WEB_APP_URL = MOBILE_ENVIRONMENT.webAppOrigin;

export function webAppPath(path: string): string {
  return `${WEB_APP_URL}${path}`;
}
