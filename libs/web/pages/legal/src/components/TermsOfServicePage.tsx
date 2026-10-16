import { Button, Card, CardContent } from '@myorganiser/web-ui';
import Link from 'next/link';
import { LegalBackLink } from './LegalBackLink';
import { OperatorContact } from './OperatorContact';
import { TermsOfServiceContent } from './TermsOfServiceContent';

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <LegalBackLink />

          <h1 className="mt-4 text-lg font-semibold">Terms of Service</h1>

          <TermsOfServiceContent operatorContact={<OperatorContact />} />

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
