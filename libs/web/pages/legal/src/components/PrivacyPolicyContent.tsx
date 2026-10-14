import type { ReactNode } from 'react';
import { YouTubePrivacySection } from './YouTubePrivacySection';

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

      <YouTubePrivacySection headingLevel={Heading} linkTarget={linkTarget} />

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
          associated data. You can export your Vault data, and remove a
          device&apos;s copy of it, from the Vault page. Deleting your account
          is done on request for now: contact us using the information below and
          we will delete your account and everything stored with it. To request
          a complete copy of your data, contact us the same way.
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
