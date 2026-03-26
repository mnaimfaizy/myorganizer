'use client';

import { ChannelVideosPage } from '@myorganizer/web-pages/youtube';
import { useParams } from 'next/navigation';

export default function Page() {
  const params = useParams<{ channelId: string }>();
  return <ChannelVideosPage channelId={params.channelId} />;
}
