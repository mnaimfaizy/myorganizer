'use client';

import { useYouTubeAvailability } from '@myorganizer/web-youtube';

export function useYouTubeNavVisible(): boolean {
  return useYouTubeAvailability().available === true;
}
