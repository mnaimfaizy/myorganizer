import { Button, Card, CardContent } from '@myorganizer/web-ui';
import Link from 'next/link';
import { CURRENT_MOBILE_RELEASE } from '../lib/mobileRelease';
import { AndroidDownloadSection } from './AndroidDownloadSection';
import { IosInstallSection } from './IosInstallSection';

export interface DownloadPageProps {
  /** The Mobile Release to offer on Android, or `null` before the first one. */
  version?: string | null;
}

export function DownloadPage({
  version = CURRENT_MOBILE_RELEASE,
}: DownloadPageProps) {
  return (
    <div
      data-testid="download-page"
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
    >
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col gap-8 pt-6">
          <h1 className="text-lg font-semibold">
            Get MyOrganiser on your phone
          </h1>

          <AndroidDownloadSection version={version} />
          <IosInstallSection />

          <div className="flex justify-center pt-2">
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
