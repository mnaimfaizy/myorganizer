import Link from 'next/link';

export interface PrivacyMobileAppSectionProps {
  /** Section heading level, as PrivacyPolicyContent's. */
  headingLevel: 'h2' | 'h3';
  /** As PrivacyPolicyContent's: '_blank' inside the Sign up dialog. */
  linkTarget?: '_blank';
}

/** The privacy policy's "The Mobile App" section. */
export function PrivacyMobileAppSection({
  headingLevel: Heading,
  linkTarget,
}: PrivacyMobileAppSectionProps) {
  return (
    <section className="mt-6">
      <Heading className="text-base font-semibold">The Mobile App</Heading>
      <p className="mt-3 text-sm text-muted-foreground">
        The MyOrganiser Mobile App for Android is distributed as a download from
        our{' '}
        <Link
          href="/download"
          target={linkTarget}
          rel={linkTarget ? 'noopener noreferrer' : undefined}
          className="font-medium underline hover:text-foreground"
        >
          download page
        </Link>
        , not through an app store. On iPhone and iPad there is no app to
        download: you add the MyOrganiser web app to your Home Screen instead,
        and this policy covers it as the web app.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        The Mobile App uses the same account and the same encrypted Vault as the
        web app, and this policy applies to it in the same way. With each
        request it tells our servers its version number and whether it runs on
        Android or iOS, so we can tell when it needs updating. On your device it
        keeps your sign-in in the device&apos;s secure storage, the key for
        Biometric Unlock if you turn it on (protected by your fingerprint or
        face), and your display settings. The Mobile App contains no
        advertising, analytics, or tracking.
      </p>
    </section>
  );
}
