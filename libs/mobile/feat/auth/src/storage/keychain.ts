import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'com.myorganizer.auth';

export interface StoredCredentials {
  refreshToken: string;
}

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await Keychain.setGenericPassword('refresh_token', refreshToken, {
    service: SERVICE_NAME,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getRefreshToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({
    service: SERVICE_NAME,
  });
  if (credentials && credentials.password) {
    return credentials.password;
  }
  return null;
}

export async function clearRefreshToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE_NAME });
}
