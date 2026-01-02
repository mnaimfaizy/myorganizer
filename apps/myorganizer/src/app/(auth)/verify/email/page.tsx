import { Suspense } from 'react';
import VerifyEmailClient from './VerifyEmailClient';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
