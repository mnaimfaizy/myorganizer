import { Configuration, YouTubeApi } from '@myorganiser/app-api-client';
import { getAccessToken, getAuthAxios } from '@myorganiser/auth';
import { getApiBaseUrl } from '@myorganiser/core';

/**
 * Whether YouTube exists for the signed-in User (ADR 0129): the global
 * availability report says the feature is on AND the User holds YouTube
 * Access. The access check runs only when the switch is on, because the
 * access signal itself 404s while the switch is off.
 */
export async function getYouTubeAvailability(): Promise<boolean> {
  const api = new YouTubeApi(new Configuration({ basePath: getApiBaseUrl() }));
  const response = await api.getAvailability();

  if (response.data.available !== true) {
    return false;
  }

  return getYouTubeAccess();
}

/** The signed-in User's own YouTube Access, from `GET /youtube/access`. */
export async function getYouTubeAccess(): Promise<boolean> {
  const api = new YouTubeApi(
    new Configuration({
      basePath: getApiBaseUrl(),
      accessToken: () => getAccessToken() ?? '',
    }),
    undefined,
    getAuthAxios(),
  );
  const response = await api.getAccess();

  return response.data.granted === true;
}
