'use client';

import { useCallback, useState } from 'react';
import type { ChannelCarousel } from '../types';

interface UseEnabledChannelSelectionParams {
  channels: ChannelCarousel[];
  initialChannelId?: string | null;
}

interface UseEnabledChannelSelectionResult {
  effectiveSelectedChannelId: string | null;
  selectedChannel: ChannelCarousel | null | undefined;
  selectChannel: (channelId: string) => void;
}

export function useEnabledChannelSelection({
  channels,
  initialChannelId = null,
}: UseEnabledChannelSelectionParams): UseEnabledChannelSelectionResult {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    initialChannelId,
  );

  // Effective selection: the User's own pick when it still names an Enabled
  // Channel, otherwise the first. A deep link to a channel the User has since
  // disabled therefore opens the directory rather than an empty pane.
  const selectionIsEnabled = channels.some(
    (c) => c.channelId === selectedChannelId,
  );
  const effectiveSelectedChannelId =
    (selectionIsEnabled ? selectedChannelId : null) ??
    channels[0]?.channelId ??
    null;
  const selectedChannel = effectiveSelectedChannelId
    ? channels.find((c) => c.channelId === effectiveSelectedChannelId)
    : null;

  const selectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
  }, []);

  return {
    effectiveSelectedChannelId,
    selectedChannel,
    selectChannel,
  };
}
