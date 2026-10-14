import Link from 'next/link';
import type { ReactNode } from 'react';

export interface PrivacyPolicyContentProps {
  /** Section heading level: h2 on the standalone page, h3 inside a dialog. */
  headingLevel?: 'h2' | 'h3';
  /** Operator & Contact section, supplied by the host page or dialog. */
  operatorContact?: ReactNode;
  /** Set to '_blank' inside the Sign up dialog so in-document links keep the form mounted. */
  linkTarget?: '_blank';
}

export function PrivacyPolicyContent({
  headingLevel: Heading = 'h2',
  operatorContact,
  linkTarget,
}: PrivacyPolicyContentProps) {
  return (
    <>
      <section className="mt-6">
        <Heading className="text-base font-semibold">Overview</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          MyOrganizer is a personal organizer app that helps you manage tasks,
          addresses, contacts, grocery lists, and other personal information.
          Most of your personal content is stored in an end-to-end encrypted
          Vault: the server stores only the encrypted version and cannot read
          your actual data. Your account data — such as your email address and
          authentication credentials — is stored unencrypted to operate your
          account.
        </p>
      </section>

      <section className="mt-6">
        <Heading className="text-base font-semibold">
          YouTube Integration
        </Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          MyOrganizer can optionally connect to your YouTube account through
          Google OAuth. This connection requests the{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            youtube.readonly
          </code>{' '}
          scope, which gives MyOrganizer read-only access to your YouTube
          subscriptions and videos — with no ability to write, delete, or modify
          anything on YouTube.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong>What we store:</strong> We store only metadata for each video
          from channels you enable — video ID, title, thumbnail, publish date,
          and duration. We never store the video files themselves. Your YouTube
          OAuth tokens are encrypted at rest on our servers.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong>Revocation:</strong> You can end this connection at any time
          by disconnecting YouTube from the YouTube page in your dashboard, or
          by revoking MyOrganizer&apos;s access directly from your Google
          Account&apos;s third-party access settings. Once revoked, MyOrganizer
          stops syncing your YouTube data.
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

      <section className="mt-6">
        <Heading className="text-base font-semibold">Account Data</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          We collect and store the information you provide when creating and
          managing your account, including your email address, password hash,
          and profile information. This data is necessary to authenticate you
          and operate your account.
        </p>
      </section>

      <section className="mt-6">
        <Heading className="text-base font-semibold">
          Cookies &amp; Sessions
        </Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          MyOrganizer uses session cookies to keep you signed in. These cookies
          are secure, encrypted, and removed when you sign out or they expire.
          We do not use tracking cookies or third-party analytics cookies.
        </p>
      </section>

      <section className="mt-6">
        <Heading className="text-base font-semibold">Your Rights</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          You have the right to access, update, and delete your account and
          associated data at any time. You can export or delete your Vault data
          from your account settings. To request a complete copy of your data or
          to request deletion, contact us using the information below.
        </p>
      </section>

      {operatorContact}

      <section className="mt-6">
        <Heading className="text-base font-semibold">Policy Changes</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          We may update this privacy policy from time to time. Any changes will
          be reflected on this page, and the last update date will be noted. We
          encourage you to review this policy periodically to stay informed
          about how we protect your privacy.
        </p>
      </section>
    </>
  );
}
