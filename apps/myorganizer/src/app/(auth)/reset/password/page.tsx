import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
