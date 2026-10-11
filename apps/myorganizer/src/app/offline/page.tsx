import { OfflinePage } from '@myorganizer/web-pages/offline';

export const metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflinePage />;
}
