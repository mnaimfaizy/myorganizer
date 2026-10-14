import Link from 'next/link';

export interface YouTubePrivacySectionProps {
  /** Heading level of the host document: h2 on the standalone page, h3 inside a dialog. */
  headingLevel?: 'h2' | 'h3';
  /** Set to '_blank' inside the Sign up dialog so in-document links keep the form mounted. */
  linkTarget?: '_blank';
}

export function YouTubePrivacySection({
  headingLevel: Heading = 'h2',
  linkTarget,
}: YouTubePrivacySectionProps) {
  return (
    <section className="mt-6">
      <Heading className="text-base font-semibold">YouTube Integration</Heading>
      <p className="mt-3 text-sm text-muted-foreground">
        MyOrganizer has an optional YouTube feature. It is a private feature run
        personally by the operator, who offers it only to people they personally
        know; it is not offered to the public.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        The feature uses YouTube API Services. If your account has it and you
        connect your YouTube account through Google OAuth, MyOrganizer requests
        the{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          youtube.readonly
        </code>{' '}
        scope, which gives MyOrganizer read-only access to your YouTube
        subscriptions and the uploads of those channels — with no ability to
        write, delete, or modify anything on YouTube. Google&apos;s handling of
        your data is described in the{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline hover:text-foreground"
        >
          Google Privacy Policy
        </a>
        .
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <strong>What we store:</strong> For the channels you follow we store the
        channel ID, title, and thumbnail. For their recent uploads we store the
        video ID, title, thumbnail, publish date, and duration, and which
        uploads you have marked as watched. We never store the video files
        themselves. This metadata is kept on our servers and is not part of the
        end-to-end encrypted Vault. Your YouTube OAuth tokens are encrypted at
        rest on our servers with AES-256-GCM.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <strong>How we use and share it:</strong> We use this data only to show
        you new uploads from your channels inside MyOrganizer and, if you opt
        in, to email you a digest of them. We do not sell it, we do not use it
        for advertising, and we do not use it to train artificial intelligence
        or machine learning models. It is stored with our hosting provider, and
        a digest you opted in to is sent through our email delivery provider. It
        is not shared with anyone else, and no other MyOrganizer user can see
        it. MyOrganizer&apos;s use and transfer of information received from
        Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline hover:text-foreground"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <strong>Revocation and deletion:</strong> You can end this connection at
        any time by disconnecting YouTube from the YouTube page in your
        dashboard, or by revoking MyOrganizer&apos;s access from your{' '}
        <a
          href="https://security.google.com/settings/security/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline hover:text-foreground"
        >
          Google security settings
        </a>
        . Disconnecting revokes MyOrganizer&apos;s access at Google and
        immediately deletes your stored tokens, followed channels, cached
        uploads, watched marks, and notification and digest settings. If you
        revoke access at Google instead, MyOrganizer stops syncing your YouTube
        data. The operator may also withdraw the feature from an account.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        For detailed information about how long we keep your YouTube metadata
        and how to request deletion, see our{' '}
        <Link
          href="/youtube/data-privacy"
          target={linkTarget}
          rel={linkTarget ? 'noopener noreferrer' : undefined}
          className="font-medium underline hover:text-foreground"
        >
          YouTube Data Privacy page
        </Link>
        .
      </p>
    </section>
  );
}
