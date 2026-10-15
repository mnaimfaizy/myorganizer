export interface PrivacyAccountDeletionSectionProps {
  /** Section heading level, as PrivacyPolicyContent's. */
  headingLevel: 'h2' | 'h3';
}

/** The privacy policy's "Deleting Your Account" section. */
export function PrivacyAccountDeletionSection({
  headingLevel: Heading,
}: PrivacyAccountDeletionSectionProps) {
  return (
    <section className="mt-6">
      <Heading className="text-base font-semibold">
        Deleting Your Account
      </Heading>
      <p className="mt-3 text-sm text-muted-foreground">
        You can delete your account yourself, at any time: in the Mobile App
        under Account, and on the web on your Account page. Before deleting, you
        are offered an Escape Copy — a download of your encrypted Vault that you
        keep. You then confirm with your password and by typing DELETE.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Deletion is immediate and cannot be undone. It removes your account,
        your encrypted Vault, and all your YouTube data from our servers, ends
        your YouTube connection, and signs you out everywhere. We send a
        confirmation to your email address. Our security logs keep a record that
        administrative actions took place, with your account removed from them.
        The Mobile App also removes your sign-in and Biometric Unlock key from
        the device. An Escape Copy you downloaded, or an encrypted copy of your
        Vault kept in your web browser, stays on your own devices and is yours
        to delete.
      </p>
    </section>
  );
}
