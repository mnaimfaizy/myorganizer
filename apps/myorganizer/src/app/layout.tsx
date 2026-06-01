import type { Metadata } from 'next';

import './global.css';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myorganiser.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: 'MyOrganiser – Organize Your Life, Secure Your Data',
    template: '%s | MyOrganiser',
  },
  description:
    'The all-in-one workspace for your tasks, addresses, contacts, and personal info—protected by client-side end-to-end encryption. Keep everything organized and private.',
  keywords: [
    'organizer',
    'task manager',
    'encrypted vault',
    'privacy',
    'secure notes',
    'personal data',
    'todos',
    'contacts',
    'end-to-end encryption',
    'e2ee',
  ],
  authors: [{ name: 'MyOrganiser', url: APP_URL }],
  creator: 'MyOrganiser',
  publisher: 'MyOrganiser',

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'MyOrganiser',
    title: 'MyOrganiser – Organize Your Life, Secure Your Data',
    description:
      'The all-in-one workspace for tasks, addresses, contacts, and personal info—protected by client-side end-to-end encryption.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MyOrganiser – Secure Personal Organiser',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'MyOrganiser – Organize Your Life, Secure Your Data',
    description:
      'The all-in-one workspace for tasks, addresses, contacts, and personal info—protected by client-side end-to-end encryption.',
    images: ['/images/og-image.png'],
  },

  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiBaseUrl =
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  const routerPrefix =
    process.env.ROUTER_PREFIX ?? process.env.NEXT_PUBLIC_ROUTER_PREFIX ?? '';

  const runtimeConfigJson = JSON.stringify({
    API_BASE_URL: apiBaseUrl,
    ROUTER_PREFIX: routerPrefix,
  }).replace(/[<>&\u2028\u2029]/g, (c) => {
    switch (c) {
      case '<':
        return '\\u003c';
      case '>':
        return '\\u003e';
      case '&':
        return '\\u0026';
      case '\u2028':
        return '\\u2028';
      case '\u2029':
        return '\\u2029';
      default:
        return c;
    }
  });

  return (
    <html lang="en">
      <head>
        <meta name="myorganizer-api-base-url" content={apiBaseUrl} />
        <meta name="myorganizer-router-prefix" content={routerPrefix} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__MYORGANIZER_RUNTIME__=${runtimeConfigJson};window.MYORGANIZER_RUNTIME=window.__MYORGANIZER_RUNTIME__;`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
