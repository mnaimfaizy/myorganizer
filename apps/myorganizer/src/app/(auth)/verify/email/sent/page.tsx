import { Suspense } from 'react';
import VerifyEmailSentClient from './VerifyEmailSentClient';

export default function VerifyEmailSentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <VerifyEmailSentClient />
    </Suspense>
  );
}
