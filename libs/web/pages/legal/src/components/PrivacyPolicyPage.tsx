import { Button, Card, CardContent } from '@myorganiser/web-ui';
import Link from 'next/link';
import { LegalBackLink } from './LegalBackLink';
import { OperatorContact } from './OperatorContact';
import { PrivacyPolicyContent } from './PrivacyPolicyContent';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Card className="w-full max-w-3xl">
        <CardContent className="pt-6">
          <LegalBackLink />

          <h1 className="mt-4 text-lg font-semibold">Privacy Policy</h1>

          <PrivacyPolicyContent operatorContact={<OperatorContact />} />

          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/terms">Terms of Service</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
