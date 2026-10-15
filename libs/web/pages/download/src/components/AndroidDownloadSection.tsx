import { Button } from '@myorganiser/web-ui';
import Link from 'next/link';
import { mobileReleaseLinks } from '../lib/mobileRelease';

export interface AndroidDownloadSectionProps {
  /** The Mobile Release to offer, or `null` before the first one. */
  version: string | null;
}

export function AndroidDownloadSection({
  version,
}: AndroidDownloadSectionProps) {
  const links = version === null ? null : mobileReleaseLinks(version);

  if (links === null) {
    return (
      <section
        aria-labelledby="android-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="android-heading" className="text-base font-semibold">
          Android
        </h2>
        <div data-testid="android-no-release" className="flex flex-col gap-3">
          <p className="text-sm">
            The first Android release isn&apos;t out yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Until it is, you can use MyOrganiser in your browser.
          </p>
          <div>
            <Button asChild variant="outline">
              <Link href="/">Open the web app</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="android-heading" className="flex flex-col gap-4">
      <h2 id="android-heading" className="text-base font-semibold">
        MyOrganiser {links.version} for Android
      </h2>
      <div data-testid="android-release" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a
              data-testid="android-download-link"
              href={links.apkUrl}
              rel="noopener noreferrer"
            >
              Download the APK
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              data-testid="android-checksum-link"
              href={links.checksumUrl}
              rel="noopener noreferrer"
            >
              SHA-256 checksum
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={links.releaseUrl} rel="noopener noreferrer">
              Release notes on GitHub
            </a>
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">To install it</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open the APK file from your browser&apos;s downloads.</li>
            <li>
              If Android asks, allow this browser to install unknown apps.
            </li>
            <li>Tap Install.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Installing a newer version over the old one keeps your data.
          </p>
        </div>
      </div>
    </section>
  );
}
