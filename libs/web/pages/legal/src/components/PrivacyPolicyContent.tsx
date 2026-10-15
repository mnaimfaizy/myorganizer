import type { ReactNode } from 'react';
import { YouTubePrivacySection } from './YouTubePrivacySection';

import { PrivacyAccountDeletionSection } from './PrivacyAccountDeletionSection';
import { PrivacyMobileAppSection } from './PrivacyMobileAppSection';

export interface PrivacyPolicyContentProps {
  /** Section heading level: h2 on the standalone page, h3 inside a dialog. */
  headingLevel?: 'h2' | 'h3';
  /** Operator & Contact section, supplied by the host page or dialog. */
  operatorContact?: ReactNode;
  /** Set to '_blank' inside the Sign up dialog so in-document links keep the form mounted. */
  linkTarget?: '_blank';
}

/** When this policy last changed. Update it with every change to the wording. */
const LAST_UPDATED = '15 October 2026';

export function PrivacyPolicyContent({
  headingLevel: Heading = 'h2',
  operatorContact,
  linkTarget,
}: PrivacyPolicyContentProps) {
  return (
    <>
      <p className="mt-2 text-xs text-muted-foreground">
        Last updated: {LAST_UPDATED}
      </p>

      <section className="mt-6">
        <Heading className="text-base font-semibold">Overview</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          MyOrganiser is a personal organizer that helps you manage tasks,
          addresses, contacts, grocery lists, and other personal information, on
          the web and in the MyOrganiser Mobile App. Your personal content is
          kept in a Vault that is end-to-end encrypted: it is encrypted on your
          device with a key only you can unlock, and our servers store only the
          encrypted version, which we cannot read. Your account data — such as
          your name and email address — is stored unencrypted, because we need
          it to operate your account.
        </p>
      </section>

      <PrivacyMobileAppSection headingLevel={Heading} linkTarget={linkTarget} />

      <YouTubePrivacySection headingLevel={Heading} linkTarget={linkTarget} />

      <section className="mt-6">
        <Heading className="text-base font-semibold">Account Data</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          We collect and store the information you provide when creating and
          managing your account: your name, your email address, a hash of your
          password (never the password itself), and a User ID that identifies
          your account. We use this data only to sign you in and operate your
          account — not for advertising or tracking — and we do not sell or
          share it.
        </p>
      </section>

      <section className="mt-6">
        <Heading className="text-base font-semibold">
          Cookies &amp; Sessions
        </Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          MyOrganiser uses session cookies to keep you signed in. These cookies
          are secure, encrypted, and removed when you sign out or they expire.
          We do not use tracking cookies or third-party analytics cookies.
        </p>
      </section>

      <PrivacyAccountDeletionSection headingLevel={Heading} />

      <section className="mt-6">
        <Heading className="text-base font-semibold">Your Rights</Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          You have the right to access, update, and delete your account and
          associated data at any time. You can export your Vault data from the
          Vault page on the web, and delete your account as described above. To
          request a complete copy of your data, or for help deleting it, contact
          us using the information below.
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
