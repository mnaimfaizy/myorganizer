import { colorPrimary, colorSurface } from '@myorganiser/design-tokens';
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MyOrganiser',
    short_name: 'MyOrganiser',
    description:
      'The all-in-one workspace for your tasks, addresses, contacts, and personal info, protected by client-side end-to-end encryption.',
    // Confirmed: a signed-out visitor landing here is caught by
    // DashboardGuard (libs/web/pages/dashboard/src/components/DashboardGuard.tsx),
    // which redirects to /login; a successful login then sends them to
    // /dashboard (apps/web/src/app/(auth)/login/page.tsx). The icon
    // never dead-ends, and nothing new was added to make that true — no
    // Next.js proxy/middleware (ADR 0019).
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: colorSurface,
    theme_color: colorPrimary,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
