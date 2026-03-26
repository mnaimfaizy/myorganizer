import { ChannelVideosPage } from '@myorganizer/web-pages/youtube';

export default function Page({ params }: { params: { channelId: string } }) {
  return <ChannelVideosPage channelId={params.channelId} />;
}
