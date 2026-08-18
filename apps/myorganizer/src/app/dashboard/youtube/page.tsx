import { YouTubePage } from '@myorganizer/web-pages/youtube';
import { Suspense } from 'react';

// The client component reads the `?channel=` deep link with useSearchParams,
// which the App Router requires to sit under a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <YouTubePage />
    </Suspense>
  );
}
