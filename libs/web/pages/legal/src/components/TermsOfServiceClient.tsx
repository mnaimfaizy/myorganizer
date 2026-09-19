import { Button, Card, CardContent } from '@myorganizer/web-ui';
import Link from 'next/link';

export default function TermsOfServiceClient() {
  const operatorName = process.env.OPERATOR_NAME;
  const operatorContactEmail = process.env.OPERATOR_CONTACT_EMAIL;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <h1 className="text-lg font-semibold">Terms of Service</h1>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground">
              By using MyOrganizer, you agree to these Terms. If you do not
              agree, you may not use the service.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">Description of Service</h2>
            <p className="text-sm text-muted-foreground">
              MyOrganizer is a personal organizer application that helps you
              manage and store personal information, including tasks, addresses,
              contacts, grocery lists, and similar items. The service is built
              around an end-to-end encrypted Vault that stores your data
              securely. The server stores only the encrypted version of your
              data (ciphertext) and never has access to the unencrypted
              contents.
            </p>
            <p className="text-sm text-muted-foreground">
              MyOrganizer may offer optional integrations with third-party
              services, such as connecting your YouTube account via Google
              OAuth. These integrations are read-only and are used only to
              retrieve and display information as described in the
              documentation.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">
              Accounts and User Responsibilities
            </h2>
            <p className="text-sm text-muted-foreground">
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity that occurs under your
              account. You must keep your Vault passphrase and recovery material
              safe and secure.
            </p>
            <p className="text-sm text-muted-foreground">
              You acknowledge that the server never stores your encryption key
              or the plaintext contents of your Vault. If you lose your
              passphrase or recovery material, MyOrganizer cannot recover your
              encrypted data, as recovery is technically impossible without
              these credentials.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">Acceptable Use</h2>
            <p className="text-sm text-muted-foreground">You agree not to:</p>
            <ul className="ml-4 space-y-2 text-sm text-muted-foreground">
              <li>• Use the service for any unlawful purpose or activity</li>
              <li>
                • Attempt to breach, compromise, or bypass the security of the
                service
              </li>
              <li>
                • Attempt to gain unauthorized access to the service or its
                servers
              </li>
              <li>
                • Misuse connected third-party integrations beyond their
                intended read-only purpose
              </li>
              <li>
                • Reverse-engineer, decompile, or otherwise attempt to
                circumvent the service's technical protections
              </li>
            </ul>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">Service Availability</h2>
            <p className="text-sm text-muted-foreground">
              MyOrganizer is provided on an "as is" basis without any warranty
              of uninterrupted availability. We do not guarantee that the
              service will be available at all times, and we may perform
              maintenance or updates that temporarily affect availability.
              Features, functionality, and data structures may change at any
              time.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground">
              To the fullest extent permitted by law, MyOrganizer and its
              operators shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including without
              limitation damages for loss of data, loss of profits, or
              interruption of service, arising out of or in connection with your
              use of the service, even if we have been advised of the
              possibility of such damages.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold">Changes to These Terms</h2>
            <p className="text-sm text-muted-foreground">
              We may update these Terms of Service at any time. Changes will be
              reflected on this page. Your continued use of the service
              following any changes constitutes your acceptance of the updated
              terms.
            </p>
          </section>

          {operatorName && (
            <section className="mt-6 space-y-4">
              <h2 className="text-base font-semibold">Operator and Contact</h2>
              <p className="text-sm text-muted-foreground">
                MyOrganizer is operated by <strong>{operatorName}</strong>.
                {operatorContactEmail && (
                  <>
                    {' '}
                    You may contact us at{' '}
                    <a
                      href={`mailto:${operatorContactEmail}`}
                      className="text-primary hover:underline"
                    >
                      {operatorContactEmail}
                    </a>
                    .
                  </>
                )}
              </p>
            </section>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/privacy">Privacy Policy</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
