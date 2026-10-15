import { Share } from 'lucide-react';

// The Home Screen steps for iPhone and iPad, in the same voice as
// InstallAppInstructions' `ios` mode. That primitive requires an `onInstall`
// handler the iOS steps never call, so the copy is written out here instead.
export function IosInstallSection() {
  return (
    <section
      aria-labelledby="ios-heading"
      data-testid="ios-install"
      className="flex flex-col gap-3"
    >
      <h2 id="ios-heading" className="text-base font-semibold">
        iPhone and iPad
      </h2>
      <p className="text-sm text-muted-foreground">
        There is no app to download for iPhone or iPad. Add MyOrganiser to your
        Home Screen instead, and it opens in its own window.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Tap the Share button{' '}
          <Share
            aria-hidden="true"
            className="inline h-4 w-4 align-text-bottom"
          />
          . If it isn&apos;t in Safari&apos;s toolbar, tap{' '}
          <span aria-hidden="true">•••</span>
          <span className="sr-only">the More button</span> first.
        </li>
        <li>
          Choose Add to Home Screen. If it isn&apos;t listed, tap More first.
        </li>
      </ol>
      <p className="text-xs text-muted-foreground">
        You&apos;ll sign in and unlock your vault again inside the installed
        MyOrganiser.
      </p>
    </section>
  );
}
