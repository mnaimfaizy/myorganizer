'use client';

import { useYouTubeAvailability } from '@myorganiser/web-youtube';

export function useYouTubeNavVisible(): boolean {
  return useYouTubeAvailability().available === true;
}
