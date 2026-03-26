'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
} from '@myorganizer/web-ui';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useYouTubeVideos } from '../hooks';
import { VideoGrid } from './VideoGrid';

interface ChannelVideosClientProps {
  channelId: string;
}

export default function ChannelVideosClient({
  channelId,
}: ChannelVideosClientProps) {
  const router = useRouter();
  const {
    videos,
    loading,
    sort,
    setSort,
    search,
    setSearch,
    page,
    totalPages,
    setPage,
    total,
  } = useYouTubeVideos(channelId);

  // Derive channel title from the first video (all share the same channel)
  const channelTitle = videos[0]?.channelTitle ?? 'Channel Videos';

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/youtube')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {loading && videos.length === 0 ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            channelTitle
          )}
        </h1>
      </div>

      <Card className="p-4">
        <CardTitle>Videos</CardTitle>
        <CardContent className="mt-4">
          <VideoGrid
            videos={videos}
            loading={loading}
            sort={sort}
            onSortChange={setSort}
            search={search}
            onSearchChange={setSearch}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
