import Link from 'next/link';

import { Button } from '@myorganizer/web-ui';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-bold">MyOrganizer</h1>
        <p className="text-muted-foreground">
          Organize your life, one task at a time.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
