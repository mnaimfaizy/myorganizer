import { Platform } from 'react-native';

// Mirrors `api/client.ts`'s own `DEV_HOST` swap: an Android emulator reaches
// the host machine at 10.0.2.2, while an iOS simulator resolves localhost
// directly. Web app creation (sign-up, Vault creation) and finishing a
// password reset both stay on the web — this is where a mobile screen sends
// the User to do either.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const WEB_APP_URL = `http://${DEV_HOST}:4200`;

export function webAppPath(path: string): string {
  return `${WEB_APP_URL}${path}`;
}
