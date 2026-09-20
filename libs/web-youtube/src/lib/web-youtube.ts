import { Configuration, YouTubeApi } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';

export async function getYouTubeAvailability(): Promise<boolean> {
  const api = new YouTubeApi(new Configuration({ basePath: getApiBaseUrl() }));
  const response = await api.getAvailability();

  return response.data.available === true;
}
